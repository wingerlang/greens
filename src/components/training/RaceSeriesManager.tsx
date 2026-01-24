import React, { useState } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { RaceDefinition, RaceIgnoreRule, generateId } from '../../models/types.ts';
import { X, Plus, Trash2, Edit2, Save, AlertTriangle, ShieldAlert } from 'lucide-react';

interface RaceSeriesManagerProps {
    onClose: () => void;
}

export function RaceSeriesManager({ onClose }: RaceSeriesManagerProps) {
    const {
        raceDefinitions, addRaceDefinition, updateRaceDefinition, deleteRaceDefinition,
        raceIgnoreRules, addRaceIgnoreRule, deleteRaceIgnoreRule
    } = useData();

    const [activeTab, setActiveTab] = useState<'series' | 'ignore'>('series');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<RaceDefinition>>({});

    // Ignore Rule State
    const [newIgnorePattern, setNewIgnorePattern] = useState('');

    const handleStartEdit = (race: RaceDefinition) => {
        setEditingId(race.id);
        setEditForm({ ...race });
    };

    const handleSave = () => {
        if (!editingId || !editForm.name) return;
        updateRaceDefinition(editingId, editForm);
        setEditingId(null);
        setEditForm({});
    };

    const handleCreate = () => {
        addRaceDefinition({
            name: 'Ny Tävlingsserie',
            aliases: []
        });
    };

    const handleAddAlias = () => {
        if (!editForm.aliases) return;
        setEditForm({
            ...editForm,
            aliases: [...editForm.aliases, '']
        });
    };

    const handleUpdateAlias = (index: number, val: string) => {
        if (!editForm.aliases) return;
        const newAliases = [...editForm.aliases];
        newAliases[index] = val;
        setEditForm({ ...editForm, aliases: newAliases });
    };

    const handleRemoveAlias = (index: number) => {
        if (!editForm.aliases) return;
        const newAliases = editForm.aliases.filter((_, i) => i !== index);
        setEditForm({ ...editForm, aliases: newAliases });
    };

    const handleAddIgnoreRule = () => {
        if (!newIgnorePattern.trim()) return;
        addRaceIgnoreRule({
            pattern: newIgnorePattern,
            matchType: 'contains' // Default to contains for ease of use
        });
        setNewIgnorePattern('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-950/50 rounded-t-2xl">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                            <ShieldAlert className="text-amber-500" size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">Hantera Tävlingar</h2>
                            <p className="text-slate-400 text-sm">Gruppera lopp och dölj oönskade aktiviteter</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 bg-slate-950/30 px-6">
                    <button
                        onClick={() => setActiveTab('series')}
                        className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'series' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Tävlingsserier ({raceDefinitions.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('ignore')}
                        className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'ignore' ? 'border-rose-500 text-rose-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Ignorerade Lopp ({raceIgnoreRules.length})
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-900">

                    {/* --- SERIES TAB --- */}
                    {activeTab === 'series' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <p className="text-slate-400 text-sm max-w-lg">
                                    Skapa serier för att gruppera lopp med olika namn (t.ex. "Gbg Varvet" och "Göteborgsvarvet").
                                </p>
                                <button
                                    onClick={handleCreate}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <Plus size={16} /> Ny Serie
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {raceDefinitions.map(def => (
                                    <div key={def.id} className="bg-slate-800/50 border border-white/5 rounded-xl p-4 transition-all">
                                        {editingId === def.id ? (
                                            <div className="space-y-4">
                                                {/* Edit Mode */}
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Officiellt Namn</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.name || ''}
                                                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white font-bold focus:border-amber-500/50 focus:outline-none"
                                                    />
                                                </div>

                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-[10px] uppercase font-bold text-slate-500">Aliaser (Variationer)</label>
                                                        <button onClick={handleAddAlias} className="text-xs text-amber-500 font-bold hover:underline">+ Lägg till</button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {(editForm.aliases || []).map((alias, idx) => (
                                                            <div key={idx} className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={alias}
                                                                    onChange={e => handleUpdateAlias(idx, e.target.value)}
                                                                    className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-amber-500/50 focus:outline-none"
                                                                    placeholder="T.ex. Gbg Varvet"
                                                                />
                                                                <button onClick={() => handleRemoveAlias(idx)} className="text-slate-600 hover:text-rose-500 p-2">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {(!editForm.aliases || editForm.aliases.length === 0) && (
                                                            <div className="text-xs text-slate-600 italic px-2">Inga alias tillagda</div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
                                                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-slate-400 hover:text-white font-bold text-xs">Avbryt</button>
                                                    <button onClick={handleSave} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-lg flex items-center gap-2">
                                                        <Save size={14} /> Spara
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                                        {def.name}
                                                        <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded uppercase">{def.aliases.length} Alias</span>
                                                    </h3>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {def.aliases.map((a, i) => (
                                                            <span key={i} className="text-xs text-slate-400 bg-slate-950/50 px-2 py-1 rounded border border-white/5">{a}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleStartEdit(def)} className="p-2 text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 rounded-lg border border-white/5 transition-colors">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => deleteRaceDefinition(def.id)} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-950 hover:bg-slate-900 rounded-lg border border-white/5 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- IGNORE TAB --- */}
                    {activeTab === 'ignore' && (
                        <div className="space-y-6">
                            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3">
                                <AlertTriangle className="text-rose-500 shrink-0" size={20} />
                                <div>
                                    <h4 className="text-rose-400 font-bold text-sm mb-1">Dölj aktiviteter från tävlingslistan</h4>
                                    <p className="text-rose-300/70 text-xs">
                                        Lägg till ord eller fraser som ska exkludera aktiviteter från att synas som tävlingar, även om de är taggade som 'Race' i Strava.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newIgnorePattern}
                                    onChange={e => setNewIgnorePattern(e.target.value)}
                                    placeholder="T.ex. '1/10th Marathon' eller 'Jogg'"
                                    className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-rose-500/50 focus:outline-none"
                                    onKeyDown={e => e.key === 'Enter' && handleAddIgnoreRule()}
                                />
                                <button
                                    onClick={handleAddIgnoreRule}
                                    disabled={!newIgnorePattern.trim()}
                                    className="px-6 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
                                >
                                    Lägg till
                                </button>
                            </div>

                            <div className="space-y-2">
                                {raceIgnoreRules.length === 0 && (
                                    <p className="text-slate-500 italic text-center py-8">Inga regler tillagda.</p>
                                )}
                                {raceIgnoreRules.map(rule => (
                                    <div key={rule.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-white/5 group hover:border-white/10">
                                        <div className="flex items-center gap-3">
                                            <span className="text-slate-400 text-xs font-mono ml-2">Innehåller:</span>
                                            <span className="font-bold text-white">"{rule.pattern}"</span>
                                        </div>
                                        <button
                                            onClick={() => deleteRaceIgnoreRule(rule.id)}
                                            className="text-slate-600 hover:text-rose-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
