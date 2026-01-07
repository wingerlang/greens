import React, { useState, useEffect, useCallback } from 'react';
import { backupService } from '../../../services/backupService.ts';
import { SnapshotList } from './SnapshotList.tsx';
import { TimelineGraph } from './TimelineGraph.tsx';
import { DiffViewer } from './DiffViewer.tsx';
import { RestoreWizard } from './RestoreWizard.tsx';
import { TrackManager } from './TrackManager.tsx';
import type { BackupSnapshot, BackupSettings, BackupEntityCounts } from '../../../models/backup.ts';

export function BackupModule() {
    const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
    const [settings, setSettings] = useState<BackupSettings>(backupService.getSettings());
    const [selectedSnapshot, setSelectedSnapshot] = useState<BackupSnapshot | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [restoreModal, setRestoreModal] = useState<BackupSnapshot | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'diff' | 'tracks'>('timeline');

    const loadSnapshots = useCallback(() => {
        const currentTrack = backupService.getCurrentTrackId();
        setSnapshots(backupService.getSnapshots(currentTrack));
    }, []);

    useEffect(() => {
        loadSnapshots();
    }, [loadSnapshots]);

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleCreateBackup = async (label?: string) => {
        setIsCreating(true);
        try {
            const snapshot = backupService.createSnapshot('MANUAL', label);
            loadSnapshots();
            showNotification('success', `Backup skapad: ${backupService.formatBytes(snapshot.size)}`);
        } catch (e) {
            showNotification('error', `Kunde inte skapa backup: ${e}`);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = (id: string) => {
        const success = backupService.deleteSnapshot(id);
        if (success) {
            loadSnapshots();
            if (selectedSnapshot?.id === id) setSelectedSnapshot(null);
            showNotification('success', 'Backup borttagen');
        } else {
            showNotification('error', 'Kunde inte ta bort backup');
        }
    };

    const handleRestore = (snapshotId: string) => {
        const snapshot = backupService.getSnapshot(snapshotId);
        if (snapshot) {
            setRestoreModal(snapshot);
        }
    };

    const confirmRestore = (mode: 'FULL' | 'SELECTIVE', categories?: (keyof typeof snapshots[0]['entityCounts'])[]) => {
        if (!restoreModal) return;

        const result = backupService.restore({
            snapshotId: restoreModal.id,
            mode,
            categories,
            createBackupFirst: true,
        });

        if (result.success) {
            showNotification('success', `Återställning lyckades! Du måste ladda om sidan.`);
            loadSnapshots();
            // Trigger page reload after a short delay
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showNotification('error', result.errors?.join(', ') || 'Återställning misslyckades');
        }

        setRestoreModal(null);
    };

    const stats = backupService.getStorageStats();

    return (
        <div className="space-y-6">
            {/* Notification */}
            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl transition-all duration-300 ${notification.type === 'success'
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/20 border-red-500/30 text-red-400'
                    }`}>
                    <div className="flex items-center gap-2">
                        <span>{notification.type === 'success' ? '✓' : '✕'}</span>
                        <span className="text-sm font-medium">{notification.message}</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-white">Backup Manager</h2>
                    <p className="text-sm text-slate-500 mt-1">Hantera snapshots och återställ data</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                        title="Inställningar"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>

                    <button
                        onClick={() => handleCreateBackup()}
                        disabled={isCreating}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isCreating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Skapar...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                <span>Skapa Backup</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Totala Snapshots</div>
                    <div className="text-2xl font-black text-white">{stats.totalSnapshots}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Storlek</div>
                    <div className="text-2xl font-black text-indigo-400">{backupService.formatBytes(stats.totalSize)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Senaste Backup</div>
                    <div className="text-sm font-bold text-white">
                        {stats.newestSnapshot
                            ? new Date(stats.newestSnapshot).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '-'
                        }
                    </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Äldsta Backup</div>
                    <div className="text-sm font-bold text-white">
                        {stats.oldestSnapshot
                            ? new Date(stats.oldestSnapshot).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
                            : '-'
                        }
                    </div>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                    <h3 className="text-sm font-bold text-white mb-4">Inställningar</h3>
                    <div className="grid grid-cols-2 gap-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.autoBackupEnabled}
                                onChange={(e) => {
                                    const updated = { ...settings, autoBackupEnabled: e.target.checked };
                                    setSettings(updated);
                                    backupService.saveSettings(updated);
                                }}
                                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-300">Aktivera auto-backup</span>
                        </label>

                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-400">Max antal snapshots:</span>
                            <input
                                type="number"
                                value={settings.maxSnapshots}
                                onChange={(e) => {
                                    const updated = { ...settings, maxSnapshots: parseInt(e.target.value) || 100 };
                                    setSettings(updated);
                                    backupService.saveSettings(updated);
                                }}
                                className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white text-sm"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-400">Auto-backup intervall (timmar):</span>
                            <input
                                type="number"
                                value={settings.autoBackupIntervalHours}
                                onChange={(e) => {
                                    const updated = { ...settings, autoBackupIntervalHours: parseInt(e.target.value) || 24 };
                                    setSettings(updated);
                                    backupService.saveSettings(updated);
                                }}
                                className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white text-sm"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-400">Behåll i dagar:</span>
                            <input
                                type="number"
                                value={settings.retentionDays}
                                onChange={(e) => {
                                    const updated = { ...settings, retentionDays: parseInt(e.target.value) || 90 };
                                    setSettings(updated);
                                    backupService.saveSettings(updated);
                                }}
                                className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white text-sm"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* View Mode Toggle + Content */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'timeline'
                                ? 'bg-indigo-500 text-white'
                                : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                        >
                            📊 Tidslinje
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'list'
                                ? 'bg-indigo-500 text-white'
                                : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                        >
                            📋 Lista
                        </button>
                        <button
                            onClick={() => setViewMode('diff')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'diff'
                                ? 'bg-indigo-500 text-white'
                                : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                        >
                            🔍 Jämför
                        </button>
                        <button
                            onClick={() => setViewMode('tracks')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'tracks'
                                ? 'bg-indigo-500 text-white'
                                : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                        >
                            🌳 Spår
                        </button>
                    </div>
                    <button
                        onClick={loadSnapshots}
                        className="text-xs text-slate-500 hover:text-white transition-colors"
                    >
                        ↻ Uppdatera
                    </button>
                </div>

                {viewMode === 'timeline' && (
                    <TimelineGraph
                        snapshots={snapshots}
                        onSelectSnapshot={setSelectedSnapshot}
                        selectedId={selectedSnapshot?.id}
                    />
                )}
                {viewMode === 'list' && (
                    <SnapshotList
                        snapshots={snapshots}
                        onRefresh={loadSnapshots}
                        onRestore={handleRestore}
                        onDelete={handleDelete}
                        onSelect={setSelectedSnapshot}
                        selectedId={selectedSnapshot?.id}
                    />
                )}
                {viewMode === 'diff' && (
                    <DiffViewer
                        snapshots={snapshots}
                    />
                )}
                {viewMode === 'tracks' && (
                    <TrackManager
                        onTrackChange={loadSnapshots}
                    />
                )}
            </div>

            {restoreModal && (
                <RestoreWizard
                    snapshot={restoreModal}
                    onConfirm={confirmRestore}
                    onCancel={() => setRestoreModal(null)}
                />
            )}
        </div>
    );
}
