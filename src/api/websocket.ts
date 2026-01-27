import { getSession } from "./db/session.ts";
import { getUserById, getAdmins } from "./db/user.ts";
import { addMessage, createConversation, getSupportConversation, getConversation, getUserConversations, getMessages, getDirectConversation, markRead } from "./db/messages.ts";
import { Message, Conversation } from "../models/types.ts";

const connectedClients = new Map<string, Set<WebSocket>>(); // userId -> sockets

export function handleWebSocket(req: Request): Response {
    if (req.headers.get("upgrade") != "websocket") {
        return new Response(null, { status: 501 });
    }

    // @ts-ignore
    const { socket, response } = Deno.upgradeWebSocket(req);
    let userId: string | null = null;

    socket.onopen = () => {
        // Wait for auth
    };

    socket.onmessage = async (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data);

            if (data.type === 'auth') {
                const session = await getSession(data.token);
                if (session) {
                    userId = session.userId;
                    if (!connectedClients.has(userId)) {
                        connectedClients.set(userId, new Set());
                    }
                    connectedClients.get(userId)!.add(socket);
                    socket.send(JSON.stringify({ type: 'auth_success', userId }));
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

            if (data.type === 'get_conversations') {
                const convs = await getUserConversations(userId);
                socket.send(JSON.stringify({ type: 'conversations_list', conversations: convs }));
                return;
            }

            if (data.type === 'get_messages') {
                const { conversationId } = data;
                if (!conversationId) return;

                const conv = await getConversation(conversationId);
                if (!conv || !conv.participants.includes(userId)) {
                    socket.send(JSON.stringify({ type: 'error', message: 'Access denied' }));
                    return;
                }

                const result = await getMessages(conversationId);
                socket.send(JSON.stringify({ type: 'history', conversationId, messages: result.messages }));
                return;
            }

            if (data.type === 'send') {
                const { conversationId, content } = data;
                if (!conversationId || !content) return;

                const conv = await getConversation(conversationId);
                if (!conv || !conv.participants.includes(userId)) {
                    socket.send(JSON.stringify({ type: 'error', message: 'Access denied' }));
                    return;
                }

                const message = await addMessage(conversationId, userId, content);
                broadcastMessage(conv.participants, message);
                return;
            }

            if (data.type === 'mark_read') {
                const { conversationId } = data;
                if (!conversationId) return;

                const conv = await getConversation(conversationId);
                if (!conv || !conv.participants.includes(userId)) return;

                await markRead(conversationId, userId);

                // Re-fetch to get updated state
                const updatedConv = await getConversation(conversationId);
                if (updatedConv) {
                    // Notify everyone involved so their list updates (e.g. read receipts)
                    broadcastConversation(updatedConv.participants, updatedConv);
                }
                return;
            }

            if (data.type === 'create_support') {
                let conv = await getSupportConversation(userId);
                if (!conv) {
                    const admins = await getAdmins();
                    const adminIds = admins.map(a => a.id);
                    const participants = Array.from(new Set([userId, ...adminIds]));

                    conv = await createConversation('support', participants, 'Support Ärende');

                    // Broadcast "added" to everyone ELSE
                    const others = participants.filter(id => id !== userId);
                    broadcastConversation(others, conv);
                }

                // Always send "created" to the initiator to trigger activation
                socket.send(JSON.stringify({ type: 'conversation_created', conversation: conv }));
                return;
            }

            if (data.type === 'create_conversation') {
                const { participantIds } = data;
                if (!participantIds || !participantIds.includes(userId)) return;

                // For now only supports direct (2 people)
                if (participantIds.length !== 2) return;

                const otherId = participantIds.find(id => id !== userId);
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
                    socket.send(JSON.stringify({ type: 'conversation_added', conversation }));
                }
            }
        }
    }
}
