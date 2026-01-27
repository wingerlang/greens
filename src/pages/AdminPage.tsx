import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { type FoodItem, CATEGORY_LABELS, UNIT_LABELS } from '../models/types.ts';
import ExerciseDatabasePage from './admin/ExerciseDatabasePage.tsx';
import { UsersModule } from '../components/admin/UsersModule.tsx';
import { RoadmapModule } from '../components/admin/RoadmapModule.tsx';
import { SystemGeneratorModule } from '../components/admin/SystemGeneratorModule.tsx';
import { HealthModule } from '../components/admin/HealthModule.tsx';
import { SystemDBModule } from '../components/admin/SystemDBModule.tsx';
import { DatabasePage } from './DatabasePage.tsx';
import { ApiPage } from './ApiPage.tsx';
import { DocumentationPage } from '../components/DocumentationPage.tsx';
import { BackupModule } from '../components/admin/backup/BackupModule.tsx';
import { AnalyticsDashboard } from './admin/AnalyticsDashboard.tsx';
import { SessionsModule } from '../components/admin/SessionsModule.tsx';
import { SupportDashboard } from '../components/admin/SupportDashboard.tsx';

export const AdminPage: React.FC = () => {
    const { foodItems, recipes, updateFoodItem } = useData();
    const navigate = useNavigate();
    const location = useLocation();

    const [filter, setFilter] = useState<'all' | 'missing-kcal' | 'missing-micros' | 'no-category'>('all');
    const [search, setSearch] = useState('');
    const [editingItem, setEditingItem] = useState<FoodItem | null>(null);

    const activeTab = location.pathname.split('/').pop() || 'health';
    const setActiveTab = (tab: string) => navigate(`/admin/${tab}`);

    const handleExport = () => {
        const data = {
            foodItems,
            recipes,
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `greens_db_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const filteredItems = useMemo(() => {
        return foodItems.filter(f => {
            const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
            if (!matchesSearch) return false;

            if (filter === 'missing-kcal') return f.calories === 0;
            if (filter === 'missing-micros') return !f.iron && !f.zinc && !f.vitaminB12;
            if (filter === 'no-category') return !f.category || f.category === 'other';
            return true;
        });
    }, [foodItems, filter, search]);

    const handleInstantEdit = (id: string, field: keyof FoodItem, value: string | number) => {
        updateFoodItem(id, { [field]: value });
    };

    const getTabClass = (tab: string, colorClass: string) => {
        const isActive = location.pathname.includes(`/admin/${tab}`);
        return `pb-4 text-[10px] uppercase tracking-widest font-black transition-all px-2 whitespace-nowrap ${isActive ? `${colorClass} border-b-2 ${colorClass.replace('text-', 'border-')}` : 'text-gray-500 hover:text-gray-300'}`;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* ... header ... */}

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-800 gap-6 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('sessions')} className={getTabClass('sessions', 'text-amber-400')}>📡 Sessions</button>
                <button onClick={() => setActiveTab('support')} className={getTabClass('support', 'text-orange-400')}>🛡️ Support</button>
                <button onClick={() => setActiveTab('health')} className={getTabClass('health', 'text-emerald-400')}>🩺 Health</button>
                <button onClick={() => setActiveTab('audit')} className={getTabClass('audit', 'text-blue-400')}>🔍 Audit</button>
                <button onClick={() => setActiveTab('api')} className={getTabClass('api', 'text-sky-400')}>⚡ API</button>
                <button onClick={() => setActiveTab('generator')} className={getTabClass('generator', 'text-rose-400')}>🔧 Verktyg</button>
                <button onClick={() => setActiveTab('backup')} className={getTabClass('backup', 'text-cyan-400')}>💾 Backup</button>
                <button onClick={() => setActiveTab('systemdb')} className={getTabClass('systemdb', 'text-purple-400')}>🧬 System DB</button>
                <button onClick={() => setActiveTab('analytics')} className={getTabClass('analytics', 'text-pink-400')}>📊 Analytics</button>
            </div>

            {/* Tab Modules */}
            <Routes>
                <Route path="sessions" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><SessionsModule /></div>} />
                <Route path="support" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><SupportDashboard /></div>} />
                <Route path="health" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><HealthModule /></div>} />
                <Route path="analytics/:category?/:tab?" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><AnalyticsDashboard /></div>} />
                <Route path="exercises" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><ExerciseDatabasePage /></div>} />
                <Route path="systemdb" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><SystemDBModule /></div>} />
                <Route path="api" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><ApiPage headless={true} /></div>} />
                <Route path="database" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><DatabasePage headless={true} /></div>} />
                <Route path="docs" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><DocumentationPage headless={true} /></div>} />
                <Route path="users" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><UsersModule /></div>} />
                <Route path="generator" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><SystemGeneratorModule /></div>} />
                <Route path="backup" element={<div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><BackupModule /></div>} />
                <Route path="audit" element={
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <section className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 md:p-8 shadow-2xl overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <span className="p-2 bg-emerald-500/10 rounded-lg">🔍</span>
                                    Data Audit & Instant Edit
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {(['all', 'missing-kcal', 'missing-micros', 'no-category'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFilter(f)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'
                                                }`}
                                        >
                                            {f === 'all' ? 'Alla' : f === 'missing-kcal' ? 'Saknar Kcal' : f === 'missing-micros' ? 'Saknar Micros' : 'Ingen Kategori'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6">
                                <input
                                    type="text"
                                    placeholder="Sök råvara..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                            </div>

                            <div className="overflow-x-auto -mx-6 md:-mx-8">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-800/50 text-gray-500 border-y border-slate-800">
                                        <tr>
                                            <th className="px-6 md:px-8 py-3 font-semibold uppercase tracking-wider text-[10px]">Råvara</th>
                                            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Kcal</th>
                                            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">P / K / F</th>
                                            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Kategori</th>
                                            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Iron (mg)</th>
                                            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Zinc (mg)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {filteredItems.map(item => (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-white/[0.04] transition-colors group cursor-pointer"
                                            >
                                                <td
                                                    className="px-6 md:px-8 py-4 font-medium text-white group-hover:text-blue-400 transition-colors"
                                                    onClick={() => setEditingItem(item)}
                                                >
                                                    {item.name}
                                                    <div className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-blue-400/50">Klicka för full redigering ↗</div>
                                                </td>
                                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="number"
                                                        value={item.calories}
                                                        onChange={(e) => handleInstantEdit(item.id, 'calories', Number(e.target.value))}
                                                        className={`w-16 bg-transparent border-b border-transparent focus:border-blue-500 outline-none text-right ${item.calories === 0 ? 'text-red-400 font-bold' : 'text-gray-300'}`}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-gray-500 font-mono text-[10px]" onClick={() => setEditingItem(item)}>
                                                    {item.protein} / {item.carbs} / {item.fat}
                                                </td>
                                                <td className="px-4 py-4 font-mono text-[10px]" onClick={(e) => e.stopPropagation()}>
                                                    <select
                                                        value={item.category}
                                                        onChange={(e) => handleInstantEdit(item.id, 'category', e.target.value)}
                                                        className={`bg-transparent outline-none ${item.category === 'other' || !item.category ? 'text-amber-400' : 'text-blue-400'}`}
                                                    >
                                                        {Object.keys(CATEGORY_LABELS).map(cat => (
                                                            <option key={cat} value={cat}>{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={item.iron || 0}
                                                        onChange={(e) => handleInstantEdit(item.id, 'iron', Number(e.target.value))}
                                                        className={`w-12 bg-transparent border-b border-transparent focus:border-emerald-500 outline-none ${!item.iron ? 'text-amber-400/50' : 'text-emerald-400'}`}
                                                    />
                                                </td>
                                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={item.zinc || 0}
                                                        onChange={(e) => handleInstantEdit(item.id, 'zinc', Number(e.target.value))}
                                                        className={`w-12 bg-transparent border-b border-transparent focus:border-emerald-500 outline-none ${!item.zinc ? 'text-amber-400/50' : 'text-emerald-400'}`}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                        <div className="bg-slate-800/20 border border-slate-700/50 p-6 rounded-3xl">
                            <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                                <span>💡</span> Persistens & Lagring
                            </h4>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Dina ändringar sparas just nu i webbläsarens <code>localStorage</code>. För att spara permanent till projektfilerna, klicka på <strong>"Spara till Disk"</strong> ovan och ersätt innehållet i <code>src/data/sampleData.ts</code> eller använd bulk-importen i framtiden.
                            </p>
                        </div>
                    </div>
                } />
                <Route index element={<Navigate to="health" replace />} />
            </Routes>
            {/* Full Edit Modal */}
            {editingItem && (
                <AdminEditModal
                    item={editingItem}
                    onClose={() => setEditingItem(null)}
                    onSave={(data) => {
                        updateFoodItem(editingItem.id, data);
                        setEditingItem(null);
                    }}
                />
            )}
        </div>
    );
};

const AdminEditModal: React.FC<{
    item: FoodItem,
    onClose: () => void,
    onSave: (data: Partial<FoodItem>) => void
}> = ({ item, onClose, onSave }) => {
    const [formData, setFormData] = useState({ ...item });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black text-white">Fullständig Redigering</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl">×</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-500">Namn</label>
                        <input
                            type="text"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-500">Kategori</label>
                        <select
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 outline-none"
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                        >
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-500">Kcal</label>
                        <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2" value={formData.calories} onChange={e => setFormData({ ...formData, calories: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-500">Prote(g)</label>
                        <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2" value={formData.protein} onChange={e => setFormData({ ...formData, protein: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-500">Kolh(g)</label>
                        <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2" value={formData.carbs} onChange={e => setFormData({ ...formData, carbs: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-500">Fett(g)</label>
                        <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2" value={formData.fat} onChange={e => setFormData({ ...formData, fat: Number(e.target.value) })} />
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800">
                    <h3 className="text-sm font-bold text-emerald-400">Mikronäringsämnen (mg / µg)</h3>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Iron</label>
                            <input type="number" step="0.1" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2" value={formData.iron || 0} onChange={e => setFormData({ ...formData, iron: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Zinc</label>
                            <input type="number" step="0.1" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2" value={formData.zinc || 0} onChange={e => setFormData({ ...formData, zinc: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Calcium</label>
                            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2" value={formData.calcium || 0} onChange={e => setFormData({ ...formData, calcium: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-gray-500">B12</label>
                            <input type="number" step="0.1" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2" value={formData.vitaminB12 || 0} onChange={e => setFormData({ ...formData, vitaminB12: Number(e.target.value) })} />
                        </div>
                    </div>
                </div>

                <div className="pt-6 flex gap-3">
                    <button
                        onClick={() => onSave(formData)}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition-all active:scale-95"
                    >
                        Spara ändringar
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold py-3 rounded-2xl transition-all"
                    >
                        Avbryt
                    </button>
                </div>
            </div>
        </div>
    );
};



