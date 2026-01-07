import React, { useState, useCallback } from 'react';
import { backupService } from '../../../services/backupService.ts';
import type { BackupSnapshot, BackupEntityCounts } from '../../../models/backup.ts';

interface SnapshotListProps {
    snapshots: BackupSnapshot[];
    onRefresh: () => void;
    onRestore: (snapshotId: string) => void;
    onDelete: (snapshotId: string) => void;
    onSelect: (snapshot: BackupSnapshot) => void;
    selectedId?: string;
}

export function SnapshotList({
    snapshots,
    onRefresh,
    onRestore,
    onDelete,
    onSelect,
    selectedId,
}: SnapshotListProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('sv-SE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatBytes = (bytes: number) => backupService.formatBytes(bytes);

    const getTriggerIcon = (trigger: string) => {
        switch (trigger) {
            case 'MANUAL': return '👤';
            case 'AUTO_SCHEDULED': return '⏰';
            case 'AUTO_THRESHOLD': return '📊';
            case 'PRE_RESTORE': return '🛡️';
            case 'IMPORT': return '📥';
            default: return '💾';
        }
    };

    const getTriggerLabel = (trigger: string) => {
        switch (trigger) {
            case 'MANUAL': return 'Manuell';
            case 'AUTO_SCHEDULED': return 'Schemalagd';
            case 'AUTO_THRESHOLD': return 'Auto';
            case 'PRE_RESTORE': return 'Före återställning';
            case 'IMPORT': return 'Före import';
            default: return trigger;
        }
    };

    const getEntitySummary = (counts: BackupEntityCounts) => {
        const parts: string[] = [];
        if (counts.meals > 0) parts.push(`${counts.meals} målt.`);
        if (counts.exercises > 0) parts.push(`${counts.exercises} akt.`);
        if (counts.strengthSessions > 0) parts.push(`${counts.strengthSessions} pass`);
        if (counts.weights > 0) parts.push(`${counts.weights} väg.`);
        return parts.slice(0, 3).join(' • ') || 'Tom';
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirmDeleteId === id) {
            onDelete(id);
            setConfirmDeleteId(null);
        } else {
            setConfirmDeleteId(id);
            setTimeout(() => setConfirmDeleteId(null), 3000);
        }
    };

    if (snapshots.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <div className="text-5xl mb-4">📦</div>
                <p className="text-sm">Inga backups ännu</p>
                <p className="text-xs mt-1 opacity-70">Skapa din första backup med knappen ovan</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {snapshots.map((snapshot, index) => (
                <div
                    key={snapshot.id}
                    onClick={() => onSelect(snapshot)}
                    className={`
                        group cursor-pointer rounded-xl border transition-all duration-200
                        ${selectedId === snapshot.id
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20'}
                    `}
                >
                    <div className="p-4">
                        {/* Header Row */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">{getTriggerIcon(snapshot.trigger)}</span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">
                                            {snapshot.label || `Backup #${snapshots.length - index}`}
                                        </span>
                                        <span className={`
                                            text-[9px] px-1.5 py-0.5 rounded font-bold uppercase
                                            ${snapshot.trigger === 'MANUAL' ? 'bg-blue-500/20 text-blue-400' :
                                                snapshot.trigger === 'PRE_RESTORE' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-slate-700 text-slate-400'}
                                        `}>
                                            {getTriggerLabel(snapshot.trigger)}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        {formatDate(snapshot.timestamp)}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-mono">
                                    {formatBytes(snapshot.size)}
                                </span>

                                {/* Actions */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRestore(snapshot.id); }}
                                        className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                        title="Återställ"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(snapshot.id, e)}
                                        className={`p-1.5 rounded-lg transition-colors ${confirmDeleteId === snapshot.id
                                                ? 'bg-red-500 text-white'
                                                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                            }`}
                                        title={confirmDeleteId === snapshot.id ? 'Klicka igen för att bekräfta' : 'Ta bort'}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Summary Row */}
                        <div className="text-[10px] text-slate-400 pl-9">
                            {getEntitySummary(snapshot.entityCounts)}
                        </div>

                        {/* Expanded Details */}
                        {expandedId === snapshot.id && (
                            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-4 gap-3">
                                {Object.entries(snapshot.entityCounts).map(([key, value]) => (
                                    value > 0 && (
                                        <div key={key} className="text-center">
                                            <div className="text-lg font-black text-white">{value}</div>
                                            <div className="text-[9px] text-slate-500 uppercase">{key}</div>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Expand Toggle */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === snapshot.id ? null : snapshot.id); }}
                        className="w-full py-1.5 text-[10px] text-slate-500 hover:text-slate-300 border-t border-white/5 transition-colors"
                    >
                        {expandedId === snapshot.id ? '▲ Dölj detaljer' : '▼ Visa detaljer'}
                    </button>
                </div>
            ))}
        </div>
    );
}
