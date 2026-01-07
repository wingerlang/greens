import React, { useState, useEffect } from 'react';
import { notificationService } from '../../services/notificationService.ts';

interface NotificationItem {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
}

export const GlobalNotification: React.FC = () => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    useEffect(() => {
        const unsubscribe = notificationService.subscribe((notification) => {
            setNotifications(prev => [...prev, notification]);

            // Auto-remove
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== notification.id));
            }, notification.duration || 3000);
        });

        return () => unsubscribe();
    }, []);

    if (notifications.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            {notifications.map(n => (
                <div
                    key={n.id}
                    className={`
                        pointer-events-auto px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md animate-in slide-in-from-right-4 duration-300 flex items-center gap-3 min-w-[300px]
                        ${n.type === 'success' ? 'bg-emerald-900/80 border-emerald-500/50 text-emerald-100' : ''}
                        ${n.type === 'error' ? 'bg-rose-900/80 border-rose-500/50 text-rose-100' : ''}
                        ${n.type === 'info' ? 'bg-slate-900/80 border-slate-500/50 text-slate-100' : ''}
                    `}
                >
                    <span className="text-xl">
                        {n.type === 'success' && '✅'}
                        {n.type === 'error' && '❌'}
                        {n.type === 'info' && 'ℹ️'}
                    </span>
                    <div className="flex-1">
                        <p className="text-sm font-medium">{n.message}</p>
                    </div>
                    <button
                        onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                        className="opacity-50 hover:opacity-100 transition-opacity"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
};
