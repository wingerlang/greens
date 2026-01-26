import React, { useState, useEffect, useRef } from 'react';
import { useMessages } from '../../context/MessageContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Send, MoreVertical, ShieldCheck, MessageSquare } from 'lucide-react';

export function ChatWindow() {
    const { activeConversationId, conversations, messages, sendMessage } = useMessages();
    const { users } = useData();
    const { user: currentUser } = useAuth();
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const activeMessages = activeConversationId ? (messages[activeConversationId] || []) : [];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [activeMessages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || !activeConversationId) return;
        sendMessage(activeConversationId, inputValue.trim());
        setInputValue('');
    };

    if (!activeConversation) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400">
                <div className="text-center">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Välj en konversation för att börja chatta</p>
                </div>
            </div>
        );
    }

    const isSupport = activeConversation.type === 'support';

    // Resolve Title
    let title = activeConversation.title;
    if (!title) {
        const otherIds = activeConversation.participants.filter(id => id !== currentUser?.id);
        const otherNames = otherIds.map(id => {
            const u = users.find(user => user.id === id);
            return u ? u.username : 'Okänd';
        });
        title = otherNames.join(', ') || 'Privat konversation';
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSupport ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-500'}`}>
                        {isSupport ? <ShieldCheck size={20} /> : <span className="font-bold text-sm">{title?.substring(0,2).toUpperCase()}</span>}
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {title}
                            {isSupport && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Support</span>}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {activeConversation.participants.length} deltagare
                        </p>
                    </div>
                </div>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <MoreVertical size={20} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {activeMessages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser?.id;
                    const sender = users.find(u => u.id === msg.senderId);
                    const isLastFromSender = index === activeMessages.length - 1 || activeMessages[index + 1].senderId !== msg.senderId;

                    // Specific logic: Support chats should name the responder if it's not me
                    // If it's a support chat, and the message is NOT from me, always show name if it's the last in a block
                    const showName = !isMe && isSupport && isLastFromSender;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isMe ? 'bg-emerald-500 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-slate-700'}`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 px-1">
                                {showName && <span className="font-bold text-slate-500 dark:text-slate-300">{sender?.username || 'Admin'}</span>}
                                <span>{new Date(msg.createdAt).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <form onSubmit={handleSend} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Skriv ett meddelande..."
                        className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-500/20"
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
}
