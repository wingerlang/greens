// src/components/admin/UsersModule.tsx
import React from 'react';
import { useData } from '../../context/DataContext.tsx';

export const UsersModule: React.FC = () => {
    const { users, currentUser, setCurrentUser } = useData();

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="p-2 bg-blue-500/10 rounded-lg text-blue-400">👥</span>
                Användarhantering
            </h2>
            <div className="bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-800/50 text-gray-500 border-b border-slate-800">
                        <tr>
                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Namn / Email</th>
                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Roll</th>
                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Plan</th>
                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Status</th>
                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px] text-right">Åtgärd</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {users.map(user => (
                            <tr key={user.id} className={`hover:bg-white/[0.02] transition-colors ${currentUser?.id === user.id ? 'bg-blue-500/5' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-white">{user.name}</div>
                                    <div className="text-xs text-gray-500">{user.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] px-2 py-1 rounded-lg uppercase tracking-widest font-bold ${user.role === 'admin' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-slate-800 text-gray-400'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] px-2 py-1 rounded-lg uppercase tracking-widest font-bold ${user.plan === 'evergreen' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-gray-400'
                                        }`}>
                                        {user.plan === 'evergreen' ? '🌲 Evergreen' : 'Gratis'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {currentUser?.id === user.id ? (
                                        <span className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
                                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                                            Aktiv Nu
                                        </span>
                                    ) : (
                                        <span className="text-gray-500 text-xs">Offline</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => setCurrentUser(user)}
                                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${currentUser?.id === user.id
                                                ? 'bg-blue-500/10 text-blue-400 cursor-default shadow-inner'
                                                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 shadow-sm'
                                            }`}
                                    >
                                        {currentUser?.id === user.id ? 'Vald' : 'Byt till'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
