import React from 'react';
import { ArrowRight } from 'lucide-react';

interface UserResultsModuleProps {
    userResults: any[];
    selectableItems: any[];
    selectedIndex: number;
    visitStats: any;
    navigate: (path: string) => void;
    onClose: () => void;
    logEvent: (type: "other" | "change" | "click" | "copy" | "error" | "submit" | "omnibox_search" | "omnibox_log" | "omnibox_nav" | "quick_add_log" | "estimate_lunch_log" | "rage_click" | "dead_click", label: string, target?: string, metadata?: any) => void;
}

export const UserResultsModule: React.FC<UserResultsModuleProps> = ({
    userResults,
    selectableItems,
    selectedIndex,
    visitStats,
    navigate,
    onClose,
    logEvent
}) => {
    return (
        <div className="px-2 py-2">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span>👥</span> Personer ({userResults.length})
            </div>
            {userResults.map((user, idx) => {
                const globalIdx = selectableItems.findIndex(i => i.itemType === 'user' && i.id === user.id);
                return (
                    <div
                        key={user.id}
                        id={`omnibox-item-${globalIdx}`}
                        onClick={() => { 
                            const path = `/u/${user.handle || user.username}`;
                            logEvent('omnibox_nav', `Navigated to user ${user.name}`, 'omnibox', { path });
                            navigate(path); 
                            onClose(); 
                        }}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${globalIdx === selectedIndex
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'hover:bg-white/5 text-white'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-400">
                                {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover rounded-lg" alt={user.name} /> : user.name[0]}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="font-medium">{user.name}</div>
                                    {visitStats.users[user.id] > 0 && (
                                        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">
                                            👤 {visitStats.users[user.id]} besök
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-500">@{user.handle || user.username}</div>
                            </div>
                        </div>
                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                );
            })}
        </div>
    );
};
