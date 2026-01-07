import React, { useState, useEffect, useMemo } from 'react';
import { backupService } from '../../../services/backupService.ts';
import type { BackupTrack, BackupSnapshot } from '../../../models/backup.ts';

interface TrackManagerProps {
    onTrackChange?: () => void;
}

export function TrackManager({ onTrackChange }: TrackManagerProps) {
    const [tracks, setTracks] = useState<BackupTrack[]>([]);
    const [currentTrackId, setCurrentTrackId] = useState<string>('main');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [newTrackName, setNewTrackName] = useState('');
    const [newTrackDescription, setNewTrackDescription] = useState('');
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const loadTracks = () => {
        setTracks(backupService.getTracks());
        setCurrentTrackId(backupService.getCurrentTrackId());
    };

    useEffect(() => {
        loadTracks();
    }, []);

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleCreateTrack = () => {
        if (!newTrackName.trim()) {
            showNotification('error', 'Ange ett namn för spåret');
            return;
        }

        try {
            // Create a backup before branching
            backupService.createSnapshot('MANUAL', `Före branch: ${newTrackName}`);

            const track = backupService.createTrack(newTrackName.trim(), newTrackDescription.trim() || undefined);

            // Switch to new track
            backupService.setCurrentTrack(track.id);

            loadTracks();
            setShowCreateModal(false);
            setNewTrackName('');
            setNewTrackDescription('');
            showNotification('success', `Spår "${track.name}" skapat och aktiverat`);
            onTrackChange?.();
        } catch (e) {
            showNotification('error', `Kunde inte skapa spår: ${e}`);
        }
    };

    const handleSwitchTrack = (trackId: string) => {
        if (trackId === currentTrackId) return;

        // Create a backup before switching
        try {
            backupService.createSnapshot('MANUAL', 'Före spårbyte');
        } catch (e) {
            console.error('Failed to create pre-switch backup:', e);
        }

        backupService.setCurrentTrack(trackId);
        setCurrentTrackId(trackId);
        showNotification('success', `Bytte till spår "${tracks.find(t => t.id === trackId)?.name}"`);
        onTrackChange?.();
    };

    const currentTrack = tracks.find(t => t.id === currentTrackId);

    // Get snapshot counts per track
    const trackStats = useMemo(() => {
        const stats: Record<string, { count: number; latestDate?: string }> = {};
        for (const track of tracks) {
            const snapshots = backupService.getSnapshots(track.id);
            stats[track.id] = {
                count: snapshots.length,
                latestDate: snapshots[0]?.timestamp,
            };
        }
        return stats;
    }, [tracks]);

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
                    <h3 className="text-lg font-bold text-white">Parallella Spår</h3>
                    <p className="text-xs text-slate-500">Git-liknande branching för din data</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowCompareModal(true)}
                        className="px-3 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white text-xs font-bold transition-colors"
                    >
                        🔀 Jämför spår
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-3 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 transition-colors"
                    >
                        ➕ Nytt spår
                    </button>
                </div>
            </div>

            {/* Current Track Banner */}
            {currentTrack && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></div>
                            <div>
                                <div className="text-sm font-bold text-white">Aktivt spår: {currentTrack.name}</div>
                                <div className="text-[10px] text-indigo-400/70">
                                    {currentTrack.description || 'Inget beskrivning'}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-black text-indigo-400">
                                {trackStats[currentTrackId]?.count || 0}
                            </div>
                            <div className="text-[10px] text-slate-500">snapshots</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Track List */}
            <div className="space-y-2">
                {tracks.map(track => {
                    const isActive = track.id === currentTrackId;
                    const stats = trackStats[track.id];

                    return (
                        <div
                            key={track.id}
                            className={`rounded-xl border p-4 transition-all ${isActive
                                    ? 'border-indigo-500/50 bg-indigo-500/5'
                                    : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-indigo-500' : 'bg-slate-600'
                                        }`}></div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-white">{track.name}</span>
                                            {track.isDefault && (
                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 uppercase">Standard</span>
                                            )}
                                            {isActive && (
                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-400 uppercase">Aktiv</span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            {track.description || 'Ingen beskrivning'} • Skapad {new Date(track.createdAt).toLocaleDateString('sv-SE')}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-right mr-4">
                                        <div className="text-sm font-bold text-white">{stats?.count || 0}</div>
                                        <div className="text-[9px] text-slate-500">
                                            {stats?.latestDate
                                                ? `Senast ${new Date(stats.latestDate).toLocaleDateString('sv-SE')}`
                                                : 'Inga backups'
                                            }
                                        </div>
                                    </div>

                                    {!isActive && (
                                        <button
                                            onClick={() => handleSwitchTrack(track.id)}
                                            className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-indigo-500 hover:text-white text-xs font-bold transition-colors"
                                        >
                                            Byt hit
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Branch lineage */}
                            {track.parentTrackId && (
                                <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-slate-500">
                                    <span className="opacity-50">↳</span> Grenad från: {tracks.find(t => t.id === track.parentTrackId)?.name || 'Okänt spår'}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Visual Branch Graph */}
            {tracks.length > 1 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                    <h4 className="text-sm font-bold text-white mb-4">Spårstruktur</h4>
                    <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                            <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-emerald-400"></div>
                            <div className="w-0.5 h-8 bg-gradient-to-b from-emerald-500 to-slate-700"></div>
                        </div>
                        <div className="flex-1 pt-0.5">
                            <div className="text-xs font-bold text-white">{tracks.find(t => t.isDefault)?.name || 'main'}</div>
                            <div className="text-[10px] text-slate-500">Primärt spår</div>

                            {/* Child branches */}
                            <div className="mt-4 ml-2 space-y-3">
                                {tracks.filter(t => !t.isDefault).map(track => (
                                    <div key={track.id} className="flex items-start gap-3">
                                        <div className="flex items-center">
                                            <div className="w-4 h-0.5 bg-slate-700"></div>
                                            <div className={`w-3 h-3 rounded-full ${track.id === currentTrackId ? 'bg-indigo-500' : 'bg-slate-600'
                                                }`}></div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-white">{track.name}</div>
                                            <div className="text-[9px] text-slate-500">
                                                {trackStats[track.id]?.count || 0} snapshots
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h4 className="text-sm font-bold text-white mb-2">💡 Hur fungerar spår?</h4>
                <ul className="text-xs text-slate-500 space-y-1">
                    <li>• Skapa ett nytt spår för att experimentera med din data</li>
                    <li>• Byt mellan spår för att se olika versioner av datan</li>
                    <li>• Varje spår har sina egna backups</li>
                    <li>• Jämför spår för att se skillnader</li>
                </ul>
            </div>

            {/* Create Track Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-4">Skapa nytt spår</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Namn *</label>
                                <input
                                    type="text"
                                    value={newTrackName}
                                    onChange={(e) => setNewTrackName(e.target.value)}
                                    placeholder="t.ex. experiment-ny-diet"
                                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-indigo-500 outline-none"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Beskrivning</label>
                                <textarea
                                    value={newTrackDescription}
                                    onChange={(e) => setNewTrackDescription(e.target.value)}
                                    placeholder="Valfri beskrivning av spåret..."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-indigo-500 outline-none resize-none"
                                />
                            </div>
                        </div>

                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mt-4">
                            <div className="text-xs text-amber-400">
                                <span className="font-bold">⚠️ OBS:</span> Ett nytt spår startar med en kopia av nuvarande data.
                                En backup skapas automatiskt innan greningen.
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewTrackName('');
                                    setNewTrackDescription('');
                                }}
                                className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={handleCreateTrack}
                                disabled={!newTrackName.trim()}
                                className="flex-1 px-4 py-2 rounded-lg bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Skapa spår
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Compare Tracks Modal */}
            {showCompareModal && (
                <TrackCompareModal
                    tracks={tracks}
                    onClose={() => setShowCompareModal(false)}
                />
            )}
        </div>
    );
}

// ============================================
// Track Compare Modal
// ============================================

function TrackCompareModal({ tracks, onClose }: { tracks: BackupTrack[]; onClose: () => void }) {
    const [leftTrackId, setLeftTrackId] = useState(tracks[0]?.id || '');
    const [rightTrackId, setRightTrackId] = useState(tracks[1]?.id || tracks[0]?.id || '');

    const leftSnapshots = useMemo(() => backupService.getSnapshots(leftTrackId), [leftTrackId]);
    const rightSnapshots = useMemo(() => backupService.getSnapshots(rightTrackId), [rightTrackId]);

    const leftLatest = leftSnapshots[0];
    const rightLatest = rightSnapshots[0];

    // Compare entity counts between latest snapshots
    const comparison = useMemo(() => {
        if (!leftLatest || !rightLatest) return null;

        const categories = Object.keys(leftLatest.entityCounts) as (keyof typeof leftLatest.entityCounts)[];
        return categories.map(cat => ({
            category: cat,
            left: leftLatest.entityCounts[cat],
            right: rightLatest.entityCounts[cat],
            diff: rightLatest.entityCounts[cat] - leftLatest.entityCounts[cat],
        })).filter(c => c.left !== c.right || c.left > 0);
    }, [leftLatest, rightLatest]);

    const categoryLabels: Record<string, string> = {
        meals: 'Måltider',
        exercises: 'Aktiviteter',
        weights: 'Vägningar',
        recipes: 'Recept',
        foodItems: 'Råvaror',
        weeklyPlans: 'Veckoplaneringar',
        goals: 'Mål',
        periods: 'Perioder',
        strengthSessions: 'Styrkepass',
        sleepSessions: 'Sömn',
        bodyMeasurements: 'Kroppsmått',
        vitals: 'Dagliga värden',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">Jämför spår</h3>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Track Selectors */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Spår A</label>
                            <select
                                value={leftTrackId}
                                onChange={(e) => setLeftTrackId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-indigo-500 outline-none"
                            >
                                {tracks.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <div className="text-[10px] text-slate-500 mt-1">
                                {leftSnapshots.length} snapshots
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Spår B</label>
                            <select
                                value={rightTrackId}
                                onChange={(e) => setRightTrackId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-indigo-500 outline-none"
                            >
                                {tracks.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <div className="text-[10px] text-slate-500 mt-1">
                                {rightSnapshots.length} snapshots
                            </div>
                        </div>
                    </div>

                    {/* Comparison Table */}
                    {comparison && comparison.length > 0 ? (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Kategori</th>
                                        <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase">{tracks.find(t => t.id === leftTrackId)?.name}</th>
                                        <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase">{tracks.find(t => t.id === rightTrackId)?.name}</th>
                                        <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-500 uppercase">Skillnad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {comparison.map(row => (
                                        <tr key={row.category} className="hover:bg-white/[0.02]">
                                            <td className="px-4 py-2 text-white">{categoryLabels[row.category] || row.category}</td>
                                            <td className="px-4 py-2 text-right text-slate-400">{row.left}</td>
                                            <td className="px-4 py-2 text-right text-slate-400">{row.right}</td>
                                            <td className={`px-4 py-2 text-right font-bold ${row.diff > 0 ? 'text-emerald-400' : row.diff < 0 ? 'text-red-400' : 'text-slate-600'
                                                }`}>
                                                {row.diff > 0 ? `+${row.diff}` : row.diff}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500">
                            <div className="text-4xl mb-3">📊</div>
                            <p className="text-sm">
                                {leftTrackId === rightTrackId
                                    ? 'Välj två olika spår för att jämföra'
                                    : 'Inga snapshots att jämföra'
                                }
                            </p>
                        </div>
                    )}

                    {/* Future: Merge button */}
                    {leftTrackId !== rightTrackId && comparison && comparison.length > 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-bold text-white">Merge-funktion</div>
                                    <div className="text-[10px] text-slate-500">Kombinera data från två spår</div>
                                </div>
                                <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                    Kommer snart
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
