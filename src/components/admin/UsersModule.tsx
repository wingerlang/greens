import React, { useEffect, useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { User } from '../../models/types.ts';

export const UsersModule: React.FC = () => {
    // const { users, currentUser, setCurrentUser } = useData(); // Legacy
    const { user: authUser } = useAuth();
    const [apiUsers, setApiUsers] = useState<User[]>([]);

    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` } // In real app, add admin check middleware
            })
                .then(res => res.json())
                .then(data => setApiUsers(data.users || []))
                .catch(console.error);
        }
    }, [authUser]);

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
                        {apiUsers.map(user => (
                            <tr key={user.id} className={`hover:bg-white/[0.02] transition-colors ${authUser?.id === user.id ? 'bg-blue-500/5' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-white">{user.username}</div>
                                    <div className="text-xs text-gray-500">{user.email || '-'}</div>
                                    <div className="text-[10px] text-gray-600 font-mono mt-1">{user.id}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        value={user.role}
                                        onChange={(e) => {
                                            const newRole = e.target.value as 'user' | 'admin';
                                            if (!confirm(`Are you sure you want to change ${user.username}'s role to ${newRole}?`)) return;

                                            // Optimistic update
                                            setApiUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));

                                            fetch(`/api/admin/users/${user.id}/role`, {
                                                method: 'PATCH',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                                                },
                                                body: JSON.stringify({ role: newRole })
                                            }).catch(err => {
                                                console.error(err);
                                                // Revert on error
                                                setApiUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: user.role } : u));
                                            });
                                        }}
                                        className={`text-[10px] px-2 py-1 rounded-lg uppercase tracking-widest font-bold border-none outline-none cursor-pointer ${user.role === 'admin'
                                            ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                                            : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                                            }`}
                                    >
                                        <option value="user">USER</option>
                                        <option value="admin">ADMIN</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[10px] px-2 py-1 rounded-lg uppercase tracking-widest font-bold bg-slate-800 text-gray-400">
                                        Standard
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {(user as any).isOnline ? (
                                        <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                            Online
                                        </span>
                                    ) : (
                                        <span className="text-gray-500 text-xs">Offline</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {authUser?.id !== user.id && (
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`Är du HELT SÄKER på att du vill ta bort användaren "${user.username}" och ALL deras data? Detta kan INTE ångras!`)) return;

                                                try {
                                                    const res = await fetch(`/api/admin/users/${user.id}`, {
                                                        method: 'DELETE',
                                                        headers: {
                                                            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                                                        }
                                                    });
                                                    if (res.ok) {
                                                        setApiUsers(prev => prev.filter(u => u.id !== user.id));
                                                        alert(`✅ Användaren ${user.username} har tagits bort.`);
                                                    } else {
                                                        const err = await res.json();
                                                        alert(`❌ Fel: ${err.error}`);
                                                    }
                                                } catch (e) {
                                                    console.error(e);
                                                    alert('❌ Kunde inte ta bort användaren.');
                                                }
                                            }}
                                            className="text-[10px] px-3 py-1.5 rounded-lg uppercase tracking-widest font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                        >
                                            🗑️ Ta bort
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
