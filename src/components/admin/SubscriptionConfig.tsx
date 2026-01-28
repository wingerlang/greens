import React, { useState, useEffect } from 'react';
import { safeFetch } from '../../utils/http.ts';
import { useData } from '../../context/DataContext.tsx';
import { PermissionConfig, FeatureKey, SubscriptionTier, DEFAULT_PERMISSION_CONFIG } from '../../models/types.ts';

export const SubscriptionConfig: React.FC = () => {
    const { permissionConfig, refreshData } = useData();
    const [config, setConfig] = useState<PermissionConfig>(permissionConfig || DEFAULT_PERMISSION_CONFIG);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    // Sync with global state when it loads
    useEffect(() => {
        if (permissionConfig) {
            setConfig(permissionConfig);
        }
    }, [permissionConfig]);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            await safeFetch('/api/admin/permissions', {
                method: 'PUT',
                body: JSON.stringify(config)
            });
            setMessage('Inställningar sparade!');
            await refreshData();
        } catch (e) {
            setMessage('Kunde inte spara.');
        } finally {
            setIsSaving(false);
        }
    };

    const updateLimit = (tier: SubscriptionTier, feature: FeatureKey, value: string | boolean) => {
        const parsed = typeof value === 'boolean' ? value : parseInt(value);
        setConfig(prev => ({
            ...prev,
            [tier]: {
                ...prev[tier],
                [feature]: isNaN(parsed as number) && typeof value !== 'boolean' ? 0 : parsed
            }
        }));
    };

    const features: FeatureKey[] = ['MAX_ACTIVE_GOALS', 'CALORIE_DETAILS', 'MAX_WORKOUTS', 'MAX_CUSTOM_FOODS', 'MAX_RECIPES'];

    return (
        <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>⚙️</span> Medlemskapsgränser (Gatekeeper)
                </h3>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white font-bold rounded-lg transition-colors"
                >
                    {isSaving ? 'Sparar...' : 'Spara Ändringar'}
                </button>
            </div>

            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${message.includes('inte') ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {message}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-slate-400 uppercase font-bold text-xs">
                        <tr>
                            <th className="px-4 py-3">Feature Key</th>
                            <th className="px-4 py-3">Free Limit</th>
                            <th className="px-4 py-3">Evergreen Limit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {features.map(feature => (
                            <tr key={feature} className="hover:bg-white/5">
                                <td className="px-4 py-3 font-mono text-slate-300">{feature}</td>
                                <td className="px-4 py-3">
                                    <LimitInput
                                        value={config.free[feature]}
                                        onChange={v => updateLimit('free', feature, v)}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <LimitInput
                                        value={config.evergreen[feature]}
                                        onChange={v => updateLimit('evergreen', feature, v)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-slate-500 mt-4">
                Sätt värde till 9999 för "Obegränsat". Checkbox för features som är on/off.
            </p>
        </section>
    );
};

const LimitInput: React.FC<{ value: number | boolean, onChange: (v: string | boolean) => void }> = ({ value, onChange }) => {
    if (typeof value === 'boolean') {
        return (
            <input
                type="checkbox"
                checked={value}
                onChange={e => onChange(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
        );
    }
    return (
        <input
            type="number"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white focus:ring-1 focus:ring-emerald-500 outline-none"
        />
    );
};
