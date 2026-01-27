import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext.tsx';
import { Conversation, Message } from '../models/types.ts';
import { useTitleNotification } from '../hooks/useTitleNotification.ts';

interface MessageContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    messages: Record<string, Message[]>;
    setActiveConversationId: (id: string | null) => void;

    // Actions
    sendMessage: (conversationId: string, content: string, type?: 'text'|'image'|'component', metadata?: any) => void;
    replyToMessage: (conversationId: string, content: string, replyToId: string) => void;
    addReaction: (conversationId: string, messageId: string, emoji: string) => void;

    // Management
    createSupportChat: () => void;
    startConversation: (userId: string) => void;
    toggleLock: (conversationId: string, isLocked: boolean) => void;
    toggleHide: (conversationId: string, isHidden: boolean) => void;
    verifyPassword: (password: string) => Promise<boolean>;

    // Admin Support
    getSupportQueue: () => void;
    assignSupport: (conversationId: string, targetAdminId?: string) => void;
    supportQueue: Conversation[]; // For admins

    isConnected: boolean;
    getHistory: (conversationId: string) => void;
    unreadCount: number;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export function MessageProvider({ children }: { children: React.ReactNode }) {
    const { token, user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [supportQueue, setSupportQueue] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Record<string, Message[]>>({});
    const [isConnected, setIsConnected] = useState(false);

    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<any>(null);

    // Promise resolver for password verification
    const passwordResolve = useRef<((success: boolean) => void) | null>(null);

    // Calculate unread count
    const unreadCount = useMemo(() => {
        if (!user) return 0;
        return conversations.reduce((acc, c) => {
            // Count conversation as unread if last message is not read by me
            const isUnread = c.lastMessage &&
                             c.lastMessage.senderId !== user.id &&
                             (!c.lastMessage.readBy || !c.lastMessage.readBy.includes(user.id));
            return isUnread ? acc + 1 : acc;
        }, 0);
    }, [conversations, user]);

    // Use the hook to update title
    useTitleNotification(unreadCount);

    const connect = useCallback(() => {
        if (!token) return;
        if (ws.current?.readyState === WebSocket.OPEN) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`; // Using /ws as defined in backend

        const socket = new WebSocket(wsUrl);

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
                    if (data.isAdmin) {
                        socket.send(JSON.stringify({ type: 'get_support_queue' }));
                    }
                }

                if (data.type === 'conversations_list') {
                    setConversations(data.conversations);
                }

                if (data.type === 'support_queue') {
                    setSupportQueue(data.conversations);
                }

                if (data.type === 'support_queue_update') {
                    // Refresh queue
                    socket.send(JSON.stringify({ type: 'get_support_queue' }));
                }

                if (data.type === 'conversation_added' || data.type === 'conversation_created') {
                    setConversations(prev => {
                        const exists = prev.find(c => c.id === data.conversation.id);
                        if (exists) return prev; // Or update?
                        return [data.conversation, ...prev];
                    });

                    if (data.type === 'conversation_created' && !data.conversation.isLocked) { // Don't auto open locked?
                         setActiveConversationId(data.conversation.id);
                    }
                }

                if (data.type === 'conversation_updated' || data.type === 'support_assigned') {
                     setConversations(prev => {
                        const exists = prev.find(c => c.id === data.conversation.id);
                        if (exists) {
                            return prev.map(c => c.id === data.conversation.id ? data.conversation : c)
                                       .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
                        }
                        return [data.conversation, ...prev].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
                    });

                    // Also update support queue if applicable
                    if (data.conversation.type === 'support') {
                        // If assigned to ME, it moves from queue to conversations.
                        // If assigned to OTHER, it might stay in queue or move to their list.
                        // Refresh queue to be safe.
                        if (user?.role === 'admin' || user?.role === 'developer') {
                            socket.send(JSON.stringify({ type: 'get_support_queue' }));
                        }
                    }
                }

                if (data.type === 'message') {
                    const msg = data.message as Message;
                    setMessages(prev => {
                        const list = prev[msg.conversationId] || [];
                        const index = list.findIndex(m => m.id === msg.id);

                        if (index !== -1) {
                            // Replace existing (e.g. reaction update)
                            const newList = [...list];
                            newList[index] = msg;
                            return { ...prev, [msg.conversationId]: newList };
                        }
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

                if (data.type === 'password_verified') {
                    if (passwordResolve.current) {
                        passwordResolve.current(data.success);
                        passwordResolve.current = null;
                    }
                }

                if (data.type === 'error') {
                    console.error("WS Backend Error:", data.message);
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
    }, [token, user]); // User dep needed for isAdmin check logic if handled locally, or just token refresh.

    useEffect(() => {
        if (token) {
            connect();
        }
        return () => {
            if (ws.current) ws.current.close();
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        };
    }, [token, connect]);

    const sendMessage = (conversationId: string, content: string, type: 'text'|'image'|'component' = 'text', metadata?: any) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'send',
                conversationId,
                content,
                messageType: type,
                metadata
            }));
        }
    };

    const replyToMessage = (conversationId: string, content: string, replyToId: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
             ws.current.send(JSON.stringify({
                type: 'send',
                conversationId,
                content,
                replyToId
            }));
        }
    };

    const addReaction = (conversationId: string, messageId: string, emoji: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'add_reaction', conversationId, messageId, emoji }));
        }
    };

    const createSupportChat = () => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'create_support' }));
        }
    };

    const startConversation = (otherUserId: string) => {
        if (!user) return;
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'create_conversation',
                participantIds: [user.id, otherUserId]
            }));
        }
    };

    const toggleLock = (conversationId: string, isLocked: boolean) => {
         if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'toggle_lock', conversationId, isLocked }));
        }
    };

    const toggleHide = (conversationId: string, isHidden: boolean) => {
         if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'toggle_hide', conversationId, isHidden }));
        }
    };

    const verifyPassword = (password: string): Promise<boolean> => {
        return new Promise((resolve) => {
            if (ws.current?.readyState === WebSocket.OPEN) {
                passwordResolve.current = resolve;
                ws.current.send(JSON.stringify({ type: 'verify_password', password }));
            } else {
                resolve(false);
            }
        });
    };

    const getHistory = (conversationId: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'get_messages', conversationId }));
        }
    }

    const getSupportQueue = () => {
         if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'get_support_queue' }));
        }
    }

    const assignSupport = (conversationId: string, targetAdminId?: string) => {
         if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'assign_support', conversationId, targetAdminId }));
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
            replyToMessage,
            addReaction,
            createSupportChat,
            startConversation,
            toggleLock,
            toggleHide,
            verifyPassword,
            getSupportQueue,
            assignSupport,
            supportQueue,
            isConnected,
            getHistory,
            unreadCount
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
