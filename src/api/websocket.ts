import { getSession } from "./db/session.ts";
import { getUserById, getAdmins } from "./db/user.ts";
import {
    addMessage,
    createConversation,
    getSupportConversation,
    getConversation,
    getUserConversations,
    getMessages,
    getDirectConversation,
    assignSupport,
    toggleLock,
    toggleHide,
    addReaction,
    getAllSupportConversations
} from "./db/messages.ts";
import { Message, Conversation } from "../models/types.ts";
import { hashPassword } from "./utils/crypto.ts";

const connectedClients = new Map<string, Set<WebSocket>>(); // userId -> sockets

export function handleWebSocket(req: Request): Response {
    if (req.headers.get("upgrade") != "websocket") {
        return new Response(null, { status: 501 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    let userId: string | null = null;
    let isAdmin = false;

    socket.onopen = () => {
        // Wait for auth
    };

    socket.onmessage = async (e) => {
        try {
            const data = JSON.parse(e.data);

            if (data.type === 'auth') {
                const session = await getSession(data.token);
                if (session) {
                    userId = session.userId;
                    const user = await getUserById(userId);
                    isAdmin = user?.role === 'admin' || user?.role === 'developer';

                    if (!connectedClients.has(userId)) {
                        connectedClients.set(userId, new Set());
                    }
                    connectedClients.get(userId)!.add(socket);
                    socket.send(JSON.stringify({ type: 'auth_success', userId, isAdmin }));
                } else {
                    socket.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
                    socket.close();
                }
                return;
            }

            if (!userId) {
                socket.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
                return;
            }

            // ============================================
            // Standard Chat
            // ============================================

            if (data.type === 'get_conversations') {
                const convs = await getUserConversations(userId);
                socket.send(JSON.stringify({ type: 'conversations_list', conversations: convs }));
                return;
            }

            if (data.type === 'get_messages') {
                const { conversationId } = data;
                if (!conversationId) return;

                const conv = await getConversation(conversationId);
                if (!conv) {
                    socket.send(JSON.stringify({ type: 'error', message: 'Conversation not found' }));
                    return;
                }

                // Check access
                const hasAccess = conv.participants.includes(userId) || (isAdmin && conv.type === 'support');
                if (!hasAccess) {
                    socket.send(JSON.stringify({ type: 'error', message: 'Access denied' }));
                    return;
                }

                const result = await getMessages(conversationId);
                socket.send(JSON.stringify({ type: 'history', conversationId, messages: result.messages }));
                return;
            }

            if (data.type === 'send') {
                const { conversationId, content, replyToId, metadata } = data;
                if (!conversationId || !content) return;

                const conv = await getConversation(conversationId);
                if (!conv) return;

                // Allow admins to reply to support tickets even if not technically "in" participant list yet (auto-join?)
                // Or enforce assignment. Let's enforce participant check, but Assign adds them.
                const hasAccess = conv.participants.includes(userId);
                if (!hasAccess) {
                    socket.send(JSON.stringify({ type: 'error', message: 'Access denied' }));
                    return;
                }

                const message = await addMessage(
                    conversationId,
                    userId,
                    content,
                    data.messageType || 'text',
                    { replyToId, metadata }
                );
                broadcastMessage(conv.participants, message);

                // Also broadcast conversation update to move it to top
                broadcastConversation(conv.participants, conv);
                return;
            }

            if (data.type === 'create_conversation') {
                const { participantIds } = data;
                if (!participantIds || !participantIds.includes(userId)) return;

                // For now only supports direct (2 people)
                if (participantIds.length !== 2) return;

                const otherId = participantIds.find((id: string) => id !== userId);
                if (!otherId) return;

                let conv = await getDirectConversation(userId, otherId);
                if (!conv) {
                    conv = await createConversation('direct', participantIds);
                    // Broadcast "added" to the OTHER person
                    broadcastConversation([otherId], conv);
                }

                // Send "created" to the initiator
                socket.send(JSON.stringify({ type: 'conversation_created', conversation: conv }));
                return;
            }

            // ============================================
            // Reactions & Metadata
            // ============================================

            if (data.type === 'add_reaction') {
                const { conversationId, messageId, emoji } = data;
                if (!conversationId || !messageId || !emoji) return;

                const conv = await getConversation(conversationId);
                if (!conv || !conv.participants.includes(userId)) return;

                const updatedMessage = await addReaction(conversationId, messageId, userId, emoji);
                broadcastMessage(conv.participants, updatedMessage);
                return;
            }

            // ============================================
            // Support System
            // ============================================

            if (data.type === 'create_support') {
                // Check if user already has an open ticket? Maybe allowed multiple?
                // Let's stick to one active support thread per user for simplicity, or just create new.
                // Re-using existing logic: "getSupportConversation" finds THE support conversation.
                // If we want a queue system, we might want multiple tickets.
                // But for V1, let's keep one main "Support Thread" per user, but admins can claim it.

                let conv = await getSupportConversation(userId);
                if (!conv) {
                    // Create with ONLY user as participant initially. Admins see it in queue.
                    conv = await createConversation(
                        'support',
                        [userId],
                        'Support Ärende',
                        { supportStatus: 'open' }
                    );

                    // Broadcast to ALL connected admins that a new ticket exists
                    broadcastToAdmins({ type: 'support_queue_update' });
                } else {
                    // If closed/resolved, maybe reopen?
                    if (conv.supportStatus === 'resolved') {
                         // Logic to reopen or create new? For now, just reuse.
                         // Maybe notify admins again
                         broadcastToAdmins({ type: 'support_queue_update' });
                    }
                }

                socket.send(JSON.stringify({ type: 'conversation_created', conversation: conv }));
                return;
            }

            if (data.type === 'get_support_queue') {
                if (!isAdmin) {
                    socket.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
                    return;
                }
                const convs = await getAllSupportConversations();
                // Filter resolved if desired, or send all.
                const active = convs.filter(c => c.supportStatus !== 'resolved');
                socket.send(JSON.stringify({ type: 'support_queue', conversations: active }));
                return;
            }

            if (data.type === 'assign_support') {
                const { conversationId, targetAdminId } = data; // targetAdminId allows assigning others
                if (!isAdmin) return;

                const assignee = targetAdminId || userId;
                const conv = await assignSupport(conversationId, assignee);

                // Notify the User that an admin joined
                broadcastConversation(conv.participants, conv);

                // Notify Admins to update queue
                broadcastToAdmins({ type: 'support_queue_update' });

                // Confirm to sender
                socket.send(JSON.stringify({ type: 'support_assigned', conversation: conv }));
                return;
            }

            // ============================================
            // Security (Lock/Hide)
            // ============================================

            if (data.type === 'toggle_lock') {
                const { conversationId, isLocked } = data;
                const conv = await getConversation(conversationId);
                if (!conv || !conv.participants.includes(userId)) return;

                const updated = await toggleLock(conversationId, isLocked);
                broadcastConversation(conv.participants, updated);
                return;
            }

            if (data.type === 'toggle_hide') {
                const { conversationId, isHidden } = data;
                const conv = await getConversation(conversationId);
                if (!conv || !conv.participants.includes(userId)) return;

                const updated = await toggleHide(conversationId, isHidden);
                broadcastConversation(conv.participants, updated);
                return;
            }

            if (data.type === 'verify_password') {
                const { password } = data;
                if (!password) return;

                const user = await getUserById(userId);
                if (!user) return;

                const hash = await hashPassword(password, user.salt);
                if (hash === user.passHash) {
                    socket.send(JSON.stringify({ type: 'password_verified', success: true }));
                } else {
                    socket.send(JSON.stringify({ type: 'password_verified', success: false }));
                }
                return;
            }

        } catch (err) {
            console.error("WS Error", err);
        }
    };

    socket.onclose = () => {
        if (userId && connectedClients.has(userId)) {
            connectedClients.get(userId)!.delete(socket);
            if (connectedClients.get(userId)!.size === 0) {
                connectedClients.delete(userId);
            }
        }
    };

    return response;
}

function broadcastMessage(userIds: string[], message: Message) {
    for (const uid of userIds) {
        if (connectedClients.has(uid)) {
            for (const socket of connectedClients.get(uid)!) {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'message', message }));
                }
            }
        }
    }
}

function broadcastConversation(userIds: string[], conversation: Conversation) {
    for (const uid of userIds) {
        if (connectedClients.has(uid)) {
            for (const socket of connectedClients.get(uid)!) {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'conversation_updated', conversation }));
                }
            }
        }
    }
}

async function broadcastToAdmins(payload: any) {
    // Find all connected admins
    // This is inefficient if we have to look up every user.
    // Optimization: Maintain a set of connectedAdminIds.
    // For now, iterate connectedClients.
    for (const [uid, sockets] of connectedClients.entries()) {
        const user = await getUserById(uid);
        if (user && (user.role === 'admin' || user.role === 'developer')) {
            for (const socket of sockets) {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify(payload));
                }
            }
        }
    }
}
