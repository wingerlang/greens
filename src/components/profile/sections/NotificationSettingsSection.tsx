// Notification Settings Section
import React from 'react';
import { useNotifications } from '../hooks/useNotifications.ts';

const NOTIFICATION_OPTIONS = [
    { key: 'emailDigest', label: 'Daglig Email-sammanfattning', icon: '📧' },
    { key: 'weeklyReport', label: 'Veckorapport via Email', icon: '📊' },
    { key: 'pushWorkouts', label: 'Push: Träningspåminnelser', icon: '💪' },
    { key: 'pushGoals', label: 'Push: Måluppdateringar', icon: '🎯' },
    { key: 'pushSocial', label: 'Push: Sociala notiser', icon: '👥' },
    { key: 'pushReminders', label: 'Push: Generella påminnelser', icon: '⏰' },
    { key: 'marketingEmails', label: 'Marknadsförings-email', icon: '📢' },
] as const;

export function NotificationSettingsSection() {
    const { settings, loading, toggle } = useNotifications();

    if (loading) return <div className="text-slate-500 text-center py-4">Laddar...</div>;

    return (
        <div className="space-y-2">
            {NOTIFICATION_OPTIONS.map(opt => (
                <div
                    key={opt.key}
                    className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-all"
                    onClick={() => toggle(opt.key)}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-lg">{opt.icon}</span>
                        <span className="text-white text-sm">{opt.label}</span>
                    </div>
                    <div className={`text-lg ${settings[opt.key] ? '' : 'grayscale opacity-40'}`}>
                        {settings[opt.key] ? '✅' : '⬜'}
                    </div>
                </div>
            ))}
        </div>
    );
}
