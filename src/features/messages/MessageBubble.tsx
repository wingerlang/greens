import React, { useState } from 'react';
import { Message } from '../../models/types.ts';
import { Reply, Smile, Plus } from 'lucide-react';

interface MessageBubbleProps {
    message: Message;
    isMe: boolean;
    senderName?: string;
    replyTo?: Message;
    onReply: (message: Message) => void;
    onReact: (message: Message, emoji: string) => void;
    currentUserId?: string;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '💪'];

export function MessageBubble({ message, isMe, senderName, replyTo, onReply, onReact, currentUserId }: MessageBubbleProps) {
    const [showActions, setShowActions] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const hasReactions = message.reactions && Object.keys(message.reactions).length > 0;

    return (
        <div
            className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'} relative mb-1`}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
        >
            {/* Reply Context */}
            {replyTo && (
                <div className={`text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 ${isMe ? 'mr-2' : 'ml-2'}`}>
                    <Reply size={12} className="rotate-180" />
                    <span>Svarar på {replyTo.senderId === currentUserId ? 'dig själv' : 'ett meddelande'}</span>
                </div>
            )}

            {replyTo && (
                 <div className={`mb-1 px-3 py-2 rounded-lg text-xs border-l-2 opacity-80 max-w-[80%]
                    ${isMe
                        ? 'bg-emerald-600 border-emerald-300 text-emerald-100'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-400 text-slate-600 dark:text-slate-400'
                    }`}>
                    <p className="line-clamp-2">{replyTo.content}</p>
                </div>
            )}

            <div className="relative max-w-[80%]">
                {/* Bubble */}
                <div className={`rounded-2xl px-4 py-3 shadow-sm relative z-10
                    ${isMe
                        ? 'bg-emerald-500 text-white rounded-br-none'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-slate-700'
                    }`}
                >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap link-autolink">
                        {/* Simple link detection could be added here or rely on library */}
                        {message.content}
                    </p>
                </div>

                {/* Actions (Hover) */}
                <div className={`absolute top-0 ${isMe ? '-left-16' : '-right-16'} h-full flex items-center gap-1 transition-opacity duration-200 ${showActions || showEmojiPicker ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                        onClick={() => onReply(message)}
                        className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        title="Svara"
                    >
                        <Reply size={16} />
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`p-1.5 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors ${showEmojiPicker ? 'text-amber-500 bg-slate-100 dark:bg-slate-800' : 'text-slate-400'}`}
                            title="Reagera"
                        >
                            <Smile size={16} />
                        </button>

                        {/* Emoji Picker */}
                        {showEmojiPicker && (
                            <div className={`absolute top-full ${isMe ? 'right-0' : 'left-0'} mt-2 bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700 rounded-full p-1 flex gap-1 z-50 animate-in zoom-in-90 duration-200`}>
                                {COMMON_EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => {
                                            onReact(message, emoji);
                                            setShowEmojiPicker(false);
                                        }}
                                        className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-lg transition-transform hover:scale-125"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Reactions Display */}
                {hasReactions && (
                    <div className={`absolute -bottom-3 ${isMe ? 'left-0' : 'right-0'} flex gap-1 z-20`}>
                        {Object.entries(message.reactions || {}).map(([emoji, userIds]) => {
                            const count = userIds.length;
                            const iReacted = userIds.includes(currentUserId || '');
                            if (count === 0) return null;

                            return (
                                <button
                                    key={emoji}
                                    onClick={() => onReact(message, emoji)}
                                    className={`text-[10px] px-1.5 py-0.5 rounded-full border shadow-sm flex items-center gap-1 transition-colors
                                        ${iReacted
                                            ? 'bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-900/50 dark:border-emerald-800 dark:text-emerald-300'
                                            : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                        }`}
                                >
                                    <span>{emoji}</span>
                                    <span className="font-bold">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Metadata / Timestamp */}
            <div className={`mt-1 flex items-center gap-2 text-[10px] text-slate-400 px-1 ${hasReactions ? 'mt-4' : ''}`}>
                {senderName && <span className="font-bold text-slate-500 dark:text-slate-300">{senderName}</span>}
                <span>{new Date(message.createdAt).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})}</span>
                {message.readBy && message.readBy.length > 1 && isMe && (
                     <span className="text-emerald-500 font-medium">Läst</span>
                )}
            </div>
        </div>
    );
}
