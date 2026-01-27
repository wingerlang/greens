import React from 'react';
import { useMessages } from '../../context/MessageContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { MessageSquare, Users, Shield, Plus } from 'lucide-react';
import { formatDateRelative } from '../../utils/formatters.ts';

import { NewChatModal } from './NewChatModal.tsx';

export function ConversationList() {
    const { conversations, activeConversationId, setActiveConversationId, createSupportChat } = useMessages();
    const { users } = useData();
    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = React.useState(''); // For future use? Or just local filter
    const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-full md:w-80">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="text-emerald-500" />
                    Meddelanden
                </h2>
                <div className="flex gap-1">
                    <button
                        onClick={() => createSupportChat()}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-amber-500 transition-colors"
                        title="Ny supportchatt"
                    >
                        <Shield size={20} />
                    </button>
                    <button
                        onClick={() => setIsNewChatOpen(true)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-emerald-500 transition-colors"
                        title="Nytt meddelande"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            <NewChatModal isOpen={isNewChatOpen} onClose={() => setIsNewChatOpen(false)} />

            <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        Inga konversationer än. Starta en chatt via plus-menyn!
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {conversations.map(conv => {
                            const isSupport = conv.type === 'support';
                            const isActive = conv.id === activeConversationId;

                            // Resolve title
                            let title = conv.title;
                            if (!title) {
                                // Find other participants
                                const otherIds = conv.participants.filter(id => id !== currentUser?.id);
                                const otherNames = otherIds.map(id => {
                                    const u = users.find(user => user.id === id);
                                    return u ? u.username : 'Okänd';
                                });
                                title = otherNames.join(', ') || 'Ingen';
                            }

                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => setActiveConversationId(conv.id)}
                                    className={`flex items-start gap-3 p-4 text-left transition-colors border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500' : 'border-l-4 border-l-transparent'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSupport ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        {isSupport ? <Shield size={20} /> : <Users size={20} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate pr-2">
                                                {title}
                                            </span>
                                            {conv.updatedAt && (
                                                <span className="text-[10px] text-slate-400 shrink-0">
                                                    {formatDateRelative(conv.updatedAt)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {conv.lastMessage ? (
                                                <>
                                                    {conv.lastMessage.senderId === currentUser?.id ? 'Du: ' : ''}
                                                    {conv.lastMessage.content}
                                                </>
                                            ) : (
                                                <span className="italic opacity-70">Inga meddelanden</span>
                                            )}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
