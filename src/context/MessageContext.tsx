import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Conversation, Message } from '../models/types.ts';

interface MessageContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    messages: Record<string, Message[]>;
    setActiveConversationId: (id: string | null) => void;
    sendMessage: (conversationId: string, content: string) => void;
    createSupportChat: () => void;
    startConversation: (userId: string) => void;
    isConnected: boolean;
    getHistory: (conversationId: string) => void;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export function MessageProvider({ children }: { children: React.ReactNode }) {
    const { token, user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Record<string, Message[]>>({});
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<any>(null);

    const connect = useCallback(() => {
        if (!token) return;
        if (ws.current?.readyState === WebSocket.OPEN) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api`; // Server checks upgrade on any path, but let's use /api to match router structure if needed, or root.
        // Wait, server integration: `Deno.serve` calls `handleWebSocket` if header present. It doesn't matter the path unless I check it.
        // In `src/api/server.ts`, I added the check *before* the router. So ANY path upgrades.
        // I'll use `/ws` to be semantic.

        const socket = new WebSocket(`${protocol}//${host}/ws`);

        socket.onopen = () => {
            console.log('WS Connected');
            setIsConnected(true);
            socket.send(JSON.stringify({ type: 'auth', token }));
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'auth_success') {
                    socket.send(JSON.stringify({ type: 'get_conversations' }));
                }

                if (data.type === 'conversations_list') {
                    setConversations(data.conversations);
                }

                if (data.type === 'conversation_added') {
                    setConversations(prev => {
                        const exists = prev.find(c => c.id === data.conversation.id);
                        if (exists) return prev;
                        return [data.conversation, ...prev];
                    });
                }

                if (data.type === 'conversation_created') {
                    setConversations(prev => {
                        const exists = prev.find(c => c.id === data.conversation.id);
                        if (exists) return prev;
                        return [data.conversation, ...prev];
                    });
                    setActiveConversationId(data.conversation.id);
                }

                if (data.type === 'message') {
                    const msg = data.message as Message;
                    setMessages(prev => {
                        const list = prev[msg.conversationId] || [];
                        if (list.some(m => m.id === msg.id)) return prev;
                        return { ...prev, [msg.conversationId]: [...list, msg] };
                    });

                    setConversations(prev => {
                        return prev.map(c => {
                            if (c.id === msg.conversationId) {
                                return { ...c, lastMessage: msg, updatedAt: msg.createdAt };
                            }
                            return c;
                        }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
                    });
                }

                if (data.type === 'history') {
                    setMessages(prev => ({
                        ...prev,
                        [data.conversationId]: data.messages.reverse()
                    }));
                }

            } catch (err) {
                console.error("WS Message Error", err);
            }
        };

        socket.onclose = () => {
            console.log('WS Disconnected');
            setIsConnected(false);
            ws.current = null;
            reconnectTimeout.current = setTimeout(connect, 3000);
        };

        ws.current = socket;
    }, [token]);

    useEffect(() => {
        if (token) {
            connect();
        }
        return () => {
            if (ws.current) ws.current.close();
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        };
    }, [token, connect]);

    const sendMessage = (conversationId: string, content: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'send', conversationId, content }));
        }
    };

    const createSupportChat = () => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'create_support' }));
        }
    };

    const startConversation = (otherUserId: string) => {
        if (!user) return;

        // Check if we already have a conversation with this user
        const existing = conversations.find(c =>
            c.type === 'private' && c.participants.includes(otherUserId)
        );

        if (existing) {
            setActiveConversationId(existing.id);
            return;
        }

        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'create_conversation',
                participantIds: [user.id, otherUserId]
            }));
        }
    };

    const getHistory = (conversationId: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'get_messages', conversationId }));
        }
    }

    useEffect(() => {
        if (activeConversationId && !messages[activeConversationId]) {
            getHistory(activeConversationId);
        }
    }, [activeConversationId]);

    return (
        <MessageContext.Provider value={{
            conversations,
            activeConversationId,
            messages,
            setActiveConversationId,
            sendMessage,
            createSupportChat,
            startConversation,
            isConnected,
            getHistory
        }}>
            {children}
        </MessageContext.Provider>
    );
}

export function useMessages() {
    const context = useContext(MessageContext);
    if (!context) throw new Error("useMessages must be used within MessageProvider");
    return context;
}
