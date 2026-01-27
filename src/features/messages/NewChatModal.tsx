import React, { useState, useMemo } from 'react';
import { X, Search, User as UserIcon, MessageCircle } from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useMessages } from '../../context/MessageContext.tsx';

interface NewChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
    const { users } = useData();
    const { user: currentUser } = useAuth();
    const { startConversation } = useMessages();
    const [search, setSearch] = useState('');

    const filteredUsers = useMemo(() => {
        if (!currentUser) return [];
        return users.filter(u =>
            u.id !== currentUser.id &&
            (u.name?.toLowerCase().includes(search.toLowerCase()) ||
                u.handle?.toLowerCase().includes(search.toLowerCase()))
        );
    }, [users, currentUser, search]);

    if (!isOpen) return null;

    const handleSelect = (userId: string) => {
        startConversation(userId);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                    <h2 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <MessageCircle className="text-emerald-500" size={20} />
                        Nytt meddelande
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Sök användare..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-500"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredUsers.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">
                            {search ? 'Inga användare hittades' : 'Inga användare tillgängliga'}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => handleSelect(user.id)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600">
                                        {user.avatarUrl ? (
                                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon size={20} className="text-slate-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 dark:text-white truncate">
                                            {user.name}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            @{user.handle || 'unknown'}
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-emerald-500 bg-emerald-500/10 rounded-full">
                                        <MessageCircle size={16} fill="currentColor" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
