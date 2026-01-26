import { getSession } from "./db/session.ts";
import { getUserById, getAdmins } from "./db/user.ts";
import { addMessage, createConversation, getSupportConversation, getConversation, getUserConversations, getMessages } from "./db/messages.ts";
import { Message, Conversation } from "../models/types.ts";

const connectedClients = new Map<string, Set<WebSocket>>(); // userId -> sockets

export function handleWebSocket(req: Request): Response {
    if (req.headers.get("upgrade") != "websocket") {
        return new Response(null, { status: 501 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    let userId: string | null = null;

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

            if (data.type === 'create_support') {
                let conv = await getSupportConversation(userId);
                if (!conv) {
                    const admins = await getAdmins();
                    const adminIds = admins.map(a => a.id);
                    // Ensure unique participants (if user is also admin)
                    const participants = Array.from(new Set([userId, ...adminIds]));

                    conv = await createConversation('support', participants, 'Support Ärende');

                    // Broadcast new conversation to everyone involved
                    broadcastConversation(participants, conv);
                } else {
                    // Just return existing one to the requester
                    socket.send(JSON.stringify({ type: 'conversation_created', conversation: conv }));
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
                    socket.send(JSON.stringify({ type: 'conversation_added', conversation }));
                }
            }
        }
    }
}
