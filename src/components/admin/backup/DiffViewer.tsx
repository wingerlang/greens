import React, { useState, useMemo } from 'react';
import type { BackupSnapshot, BackupDiff, DiffChange, BackupEntityCounts } from '../../../models/backup.ts';
import { compareSnapshots, getCategoryLabel, formatFieldValue, getDiffStats } from '../../../services/diffEngine.ts';
import { backupService } from '../../../services/backupService.ts';

interface DiffViewerProps {
    snapshots: BackupSnapshot[];
    onClose?: () => void;
}

export function DiffViewer({ snapshots, onClose }: DiffViewerProps) {
    const [fromId, setFromId] = useState<string>(snapshots[1]?.id || '');
    const [toId, setToId] = useState<string>(snapshots[0]?.id || '');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [filterType, setFilterType] = useState<'all' | 'ADDED' | 'REMOVED' | 'MODIFIED'>('all');

    const diff = useMemo(() => {
        if (!fromId || !toId || fromId === toId) return null;
        return compareSnapshots(fromId, toId);
    }, [fromId, toId]);

    const stats = useMemo(() => diff ? getDiffStats(diff) : null, [diff]);

    const filteredChanges = useMemo(() => {
        if (!diff) return [];
        if (filterType === 'all') return diff.changes;
        return diff.changes.filter(c => c.type === filterType);
    }, [diff, filterType]);

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    const getChangeIcon = (type: DiffChange['type']) => {
        switch (type) {
            case 'ADDED': return '➕';
            case 'REMOVED': return '➖';
            case 'MODIFIED': return '✏️';
        }
    };

    const getChangeColor = (type: DiffChange['type']) => {
        switch (type) {
            case 'ADDED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'REMOVED': return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'MODIFIED': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">Jämför Snapshots</h3>
                    <p className="text-xs text-slate-500">Visa skillnader mellan två backups</p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Snapshot Selectors */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Från (äldre)</label>
                    <select
                        value={fromId}
                        onChange={(e) => setFromId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-indigo-500 outline-none"
                    >
                        <option value="">Välj snapshot...</option>
                        {snapshots.map(s => (
                            <option key={s.id} value={s.id} disabled={s.id === toId}>
                                {s.label || new Date(s.timestamp).toLocaleString('sv-SE')} ({backupService.formatBytes(s.size)})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Till (nyare)</label>
                    <select
                        value={toId}
                        onChange={(e) => setToId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-indigo-500 outline-none"
                    >
                        <option value="">Välj snapshot...</option>
                        {snapshots.map(s => (
                            <option key={s.id} value={s.id} disabled={s.id === fromId}>
                                {s.label || new Date(s.timestamp).toLocaleString('sv-SE')} ({backupService.formatBytes(s.size)})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* No diff state */}
            {(!fromId || !toId) && (
                <div className="text-center py-12 text-slate-500">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-sm">Välj två snapshots för att jämföra</p>
                </div>
            )}

            {fromId && toId && fromId === toId && (
                <div className="text-center py-12 text-slate-500">
                    <div className="text-4xl mb-3">⚠️</div>
                    <p className="text-sm">Välj två olika snapshots</p>
                </div>
            )}

            {/* Diff Results */}
            {diff && stats && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                            <div className="text-2xl font-black text-white">{stats.total}</div>
                            <div className="text-[10px] text-slate-500 uppercase">Totalt</div>
                        </div>
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                            <div className="text-2xl font-black text-emerald-400">{diff.summary.totalAdded}</div>
                            <div className="text-[10px] text-emerald-500/70 uppercase">Tillagda</div>
                        </div>
                        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                            <div className="text-2xl font-black text-red-400">{diff.summary.totalRemoved}</div>
                            <div className="text-[10px] text-red-500/70 uppercase">Borttagna</div>
                        </div>
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                            <div className="text-2xl font-black text-amber-400">{diff.summary.totalModified}</div>
                            <div className="text-[10px] text-amber-500/70 uppercase">Ändrade</div>
                        </div>
                    </div>

                    {/* Category Breakdown */}
                    {stats.categories.length > 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                            <h4 className="text-sm font-bold text-white mb-3">Per kategori</h4>
                            <div className="space-y-2">
                                {stats.categories.map(cat => (
                                    <button
                                        key={cat.name}
                                        onClick={() => toggleCategory(cat.name)}
                                        className="w-full flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/5 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm">{getCategoryLabel(cat.name as keyof BackupEntityCounts)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            {cat.added > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">+{cat.added}</span>
                                            )}
                                            {cat.removed > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">-{cat.removed}</span>
                                            )}
                                            {cat.modified > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">~{cat.modified}</span>
                                            )}
                                            <span className="text-slate-600 ml-2">
                                                {expandedCategories.has(cat.name) ? '▼' : '▶'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Filter Tabs */}
                    <div className="flex gap-2">
                        {(['all', 'ADDED', 'REMOVED', 'MODIFIED'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === type
                                        ? 'bg-indigo-500 text-white'
                                        : 'bg-white/5 text-slate-400 hover:text-white'
                                    }`}
                            >
                                {type === 'all' ? 'Alla' : type === 'ADDED' ? '➕ Tillagda' : type === 'REMOVED' ? '➖ Borttagna' : '✏️ Ändrade'}
                            </button>
                        ))}
                    </div>

                    {/* Change List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredChanges.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <p className="text-sm">Inga {filterType !== 'all' ? filterType.toLowerCase() : ''} ändringar</p>
                            </div>
                        ) : (
                            filteredChanges.map((change, i) => (
                                <div
                                    key={`${change.entityId}-${i}`}
                                    className={`rounded-lg border p-3 ${getChangeColor(change.type)}`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span>{getChangeIcon(change.type)}</span>
                                            <span className="text-sm font-medium">{change.entityLabel}</span>
                                        </div>
                                        <span className="text-[10px] opacity-60 uppercase">
                                            {getCategoryLabel(change.category)}
                                        </span>
                                    </div>

                                    {/* Field changes for MODIFIED */}
                                    {change.type === 'MODIFIED' && change.fieldChanges && change.fieldChanges.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                                            {change.fieldChanges.slice(0, 5).map((fc, j) => (
                                                <div key={j} className="flex items-center gap-2 text-[10px]">
                                                    <span className="opacity-60 w-20 truncate">{fc.field}:</span>
                                                    <span className="line-through opacity-50">{formatFieldValue(fc.oldValue)}</span>
                                                    <span>→</span>
                                                    <span>{formatFieldValue(fc.newValue)}</span>
                                                </div>
                                            ))}
                                            {change.fieldChanges.length > 5 && (
                                                <div className="text-[10px] opacity-50">
                                                    ...och {change.fieldChanges.length - 5} fler fält
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Empty state */}
                    {stats.total === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            <div className="text-4xl mb-3">✓</div>
                            <p className="text-sm">Ingen skillnad mellan dessa snapshots</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
