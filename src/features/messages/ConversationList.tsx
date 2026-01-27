import React, { useState } from 'react';
import { useMessages } from '../../context/MessageContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { MessageSquare, Users, Shield, Plus, Lock, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { formatDateRelative } from '../../utils/formatters.ts';

import { NewChatModal } from './NewChatModal.tsx';

export function ConversationList() {
    const { conversations, activeConversationId, setActiveConversationId, createSupportChat, verifyPassword } = useMessages();
    const { users } = useData();
    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [showHidden, setShowHidden] = useState(false);
    const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [targetId, setTargetId] = useState<string | null>(null);
    const [passwordInput, setPasswordInput] = useState('');
    const [error, setError] = useState('');
    const [verifying, setVerifying] = useState(false);

    // Filter Logic
    const filteredConversations = conversations.filter(c => {
        // Search
        if (searchTerm && !c.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;

        // Hide/Show
        if (c.isHidden && !showHidden) return false;

        return true;
    });

    const handleConversationClick = (convId: string, isLocked: boolean) => {
        if (isLocked && !unlockedIds.has(convId)) {
            setTargetId(convId);
            setModalOpen(true);
            setError('');
            setPasswordInput('');
        } else {
            setActiveConversationId(convId);
        }
    };

    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setVerifying(true);
        setError('');

        const success = await verifyPassword(passwordInput);
        setVerifying(false);

        if (success) {
            if (targetId) {
                setUnlockedIds(prev => new Set(prev).add(targetId));
                setActiveConversationId(targetId);
            } else {
                setShowHidden(true);
            }
            setModalOpen(false);
            setTargetId(null);
        } else {
            setError('Fel lösenord');
        }
    };

    const toggleShowHidden = () => {
        if (!showHidden) {
            // Require password to show hidden
            setTargetId(null); // No specific target, general unlock
            setModalOpen(true);
        } else {
            setShowHidden(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-full md:w-80 relative">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="text-emerald-500" />
                    Meddelanden
                </h2>
                <div className="flex gap-1">
                    <button
                        <button
                        onClick={toggleShowHidden}
                        className={`p-1.5 rounded-lg transition-colors ${showHidden ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        title={showHidden ? "Dölj gömda" : "Visa gömda"}
                    >
                        {showHidden ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
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
                        {filteredConversations.map(conv => {
                            const isSupport = conv.type === 'support';
                            const isActive = conv.id === activeConversationId;
                            // Check if locked and NOT unlocked
                            const isLockedState = conv.isLocked && !unlockedIds.has(conv.id);

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
                                    onClick={() => handleConversationClick(conv.id, !!conv.isLocked)}
                                    className={`flex items-start gap-3 p-4 text-left transition-colors border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500' : 'border-l-4 border-l-transparent'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 relative ${isSupport ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        {isSupport ? <Shield size={20} /> : <Users size={20} />}
                                        {conv.isLocked && (
                                            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-0.5 shadow-sm">
                                                {isLockedState ? <Lock size={12} className="text-rose-500" /> : <ShieldAlert size={12} className="text-emerald-500" />}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className={`font-semibold text-sm truncate pr-2 flex items-center gap-1 ${isActive ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-900 dark:text-white'}`}>
                                                {title}
                                                {conv.isHidden && <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1 rounded uppercase text-slate-500">Gömd</span>}
                                            </span>
                                            {conv.lastMessage && conv.lastMessage.senderId !== currentUser?.id && (!conv.lastMessage.readBy || !conv.lastMessage.readBy.includes(currentUser?.id || '')) && (
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Oläst meddelande" />
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1 pr-2">
                                                {isLockedState ? (
                                                    <span className="italic text-slate-400 flex items-center gap-1">
                                                        <Lock size={10} />
                                                        Låst meddelande
                                                    </span>
                                                ) : (
                                                    conv.lastMessage ? (
                                                        <>
                                                            {conv.lastMessage.senderId === currentUser?.id ? 'Du: ' : ''}
                                                            {conv.lastMessage.content}
                                                        </>
                                                    ) : (
                                                        <span className="italic opacity-70">Inga meddelanden</span>
                                                    )
                                                )}
                                            </p>
                                            {conv.updatedAt && (
                                                <span className={`text-[10px] shrink-0 ${isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                                                    {formatDateRelative(conv.updatedAt)}
                                                </span>
                                            )}
                                        </div>
                                    </div >
                                </button >
                            );
                        })}
                    </div >
                )}
            </div >
            {/* Password Modal Overlay */}
            {modalOpen && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-xs border border-slate-200 dark:border-slate-700">
                        <div className="flex flex-col items-center mb-4">
                            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mb-3">
                                <Lock size={24} />
                            </div>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Lösenord krävs</h3>
                            <p className="text-sm text-slate-500 text-center">
                                {targetId ? 'Ange ditt lösenord för att låsa upp konversationen.' : 'Ange lösenord för att visa dolda konversationer.'}
                            </p>
                        </div>

                        <form onSubmit={handleVerifySubmit} className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    placeholder="Ditt lösenord"
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-center font-bold tracking-widest text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                                    autoFocus
                                />
                                {error && <p className="text-xs text-rose-500 text-center mt-2 font-bold">{error}</p>}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setModalOpen(false); setTargetId(null); }}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Avbryt
                                </button>
                                <button
                                    type="submit"
                                    disabled={!passwordInput || verifying}
                                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                                >
                                    {verifying ? 'Verifierar...' : 'Lås upp'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
