import React, { useState, useEffect, useRef } from 'react';
import { useMessages } from '../../context/MessageContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Send, MoreVertical, ShieldCheck, MessageSquare, Plus, X } from 'lucide-react';
import { MessageBubble } from './MessageBubble.tsx';
import { SmartLinkMenu } from './SmartLinkMenu.tsx';
import { Message } from '../../models/types.ts';

export function ChatWindow() {
    const { activeConversationId, conversations, messages, sendMessage, replyToMessage, addReaction, toggleLock, toggleHide, isConnected } = useMessages();
    const { users } = useData();
    const { user: currentUser } = useAuth();

    const [inputValue, setInputValue] = useState('');
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [showSmartLinks, setShowSmartLinks] = useState(false);
    const [showMenu, setShowMenu] = useState(false); // For lock/hide menu

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const activeMessages = activeConversationId ? (messages[activeConversationId] || []) : [];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [activeMessages, activeConversationId, replyTo]);

    // Clear reply state when changing conversation
    useEffect(() => {
        setReplyTo(null);
        setInputValue('');
    }, [activeConversationId]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || !activeConversationId) return;

        if (replyTo) {
            replyToMessage(activeConversationId, inputValue.trim(), replyTo.id);
            setReplyTo(null);
        } else {
            sendMessage(activeConversationId, inputValue.trim());
        }
        setInputValue('');
    };

    const onReply = (message: Message) => {
        setReplyTo(message);
        inputRef.current?.focus();
    };

    const onReact = (message: Message, emoji: string) => {
        if (!activeConversationId) return;
        addReaction(activeConversationId, message.id, emoji);
    };

    const handleSmartLinkSelect = (path: string, text: string) => {
        const link = `[${text}](${path})`; // Markdown-style, or just text?
        // For now, let's just append the link.
        // "Kolla in min profil! /profile"
        // Or if we support markdown later.
        // Let's just append the path for now, maybe with a label.
        setInputValue(prev => `${prev} ${text} (${path})`.trim());
        inputRef.current?.focus();
    };

    const handleToggleLock = () => {
        if (!activeConversationId || !activeConversation) return;
        toggleLock(activeConversationId, !activeConversation.isLocked);
        setShowMenu(false);
    };

    const handleToggleHide = () => {
        if (!activeConversationId || !activeConversation) return;
        toggleHide(activeConversationId, !activeConversation.isHidden);
        setShowMenu(false);
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
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative">
            {/* Header */}
            <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSupport ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-500'}`}>
                        {isSupport ? <ShieldCheck size={20} /> : <span className="font-bold text-sm">{title?.substring(0,2).toUpperCase()}</span>}
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {title}
                            {isSupport && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Support</span>}
                            {activeConversation.isLocked && <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Låst</span>}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {activeConversation.participants.length} deltagare {activeConversation.assignedTo && isSupport ? `(Hanteras av ${users.find(u => u.id === activeConversation.assignedTo)?.username})` : ''}
                        </p>
                    </div>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <MoreVertical size={20} />
                    </button>

                    {/* Context Menu */}
                    {showMenu && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
                             <button
                                onClick={handleToggleLock}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                            >
                                <span>{activeConversation.isLocked ? 'Lås upp chatt' : 'Lås chatt'}</span>
                                {activeConversation.isLocked ? <ShieldCheck size={14} className="text-emerald-500" /> : <ShieldCheck size={14} className="text-slate-400" />}
                            </button>
                            <button
                                onClick={handleToggleHide}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-rose-500"
                            >
                                <span>{activeConversation.isHidden ? 'Visa i listan' : 'Dölj (Arkivera)'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-2">
                {activeMessages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser?.id;
                    const sender = users.find(u => u.id === msg.senderId);
                    const isLastFromSender = index === activeMessages.length - 1 || activeMessages[index + 1].senderId !== msg.senderId;

                    // Resolve quoted message
                    const quotedMessage = msg.replyToId ? activeMessages.find(m => m.id === msg.replyToId) : undefined;

                    // Specific logic: Support chats should name the responder if it's not me
                    const showName = !isMe && (isSupport || activeConversation.participants.length > 2) && isLastFromSender;

                    return (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isMe={isMe}
                            senderName={showName ? (sender?.username || 'Okänd') : undefined}
                            replyTo={quotedMessage}
                            onReply={onReply}
                            onReact={onReact}
                            currentUserId={currentUser?.id}
                        />
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-30">
                {/* Reply Banner */}
                {replyTo && (
                    <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-t-xl border-b border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2">
                        <div className="flex flex-col text-sm border-l-4 border-emerald-500 pl-3">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                Svarar till {users.find(u => u.id === replyTo.senderId)?.username || 'Någon'}
                            </span>
                            <span className="text-slate-500 line-clamp-1">{replyTo.content}</span>
                        </div>
                        <button
                            onClick={() => setReplyTo(null)}
                            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                <div className={`flex items-end gap-2 ${replyTo ? 'bg-slate-100 dark:bg-slate-800 rounded-b-xl p-2' : ''}`}>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowSmartLinks(!showSmartLinks)}
                            className={`p-3 rounded-xl transition-colors ${showSmartLinks ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-500'}`}
                        >
                            <Plus size={20} className={showSmartLinks ? "rotate-45 transition-transform" : "transition-transform"} />
                        </button>
                        {showSmartLinks && (
                            <SmartLinkMenu
                                onSelect={handleSmartLinkSelect}
                                onClose={() => setShowSmartLinks(false)}
                            />
                        )}
                    </div>

                    <form onSubmit={handleSend} className="flex-1 flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Skriv ett meddelande..."
                            className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                        <button
                            type="submit"
                            disabled={!inputValue.trim() || !isConnected}
                            className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-500/20"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
