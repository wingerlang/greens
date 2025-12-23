// HR Zones Section with auto-detection
import React from 'react';
import { useHRZones } from '../hooks/useHRZones.ts';

interface HRZonesSectionProps {
    onUpdateProfile?: (field: string, value: any) => void;
}

const ZONE_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];

export function HRZonesSection({ onUpdateProfile }: HRZonesSectionProps) {
    const { savedZones, detectedZones, loading, hasUnsavedDetection, saveZones, refresh } = useHRZones();

    const handleApplyDetected = async () => {
        if (!detectedZones) return;
        await saveZones(detectedZones);
        if (onUpdateProfile) {
            onUpdateProfile('maxHr', detectedZones.maxHR);
            onUpdateProfile('restingHr', detectedZones.estimatedRestingHR);
            onUpdateProfile('lthr', detectedZones.estimatedLTHR);
        }
    };

    if (loading) return <div className="text-slate-500 text-center py-4">Analyserar aktiviteter...</div>;

    const zones = savedZones || detectedZones;

    return (
        <div className="space-y-4">
            {/* Detection info */}
            {hasUnsavedDetection && detectedZones && (
                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <span className="text-emerald-400 font-bold">🎯 Automatiskt detekterat från {detectedZones.activitiesAnalyzed} aktiviteter</span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${detectedZones.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
                                    detectedZones.confidence === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-red-500/20 text-red-400'
                                }`}>
                                {detectedZones.confidence === 'high' ? 'Hög' : detectedZones.confidence === 'medium' ? 'Medium' : 'Låg'} konfidens
                            </span>
                        </div>
                        <button onClick={handleApplyDetected} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600">
                            ✓ Använd dessa
                        </button>
                    </div>
                    {detectedZones.maxHRActivity && (
                        <div className="text-slate-400 text-xs">
                            Max puls {detectedZones.maxHR} bpm under "{detectedZones.maxHRActivity.name}" ({detectedZones.maxHRActivity.date})
                        </div>
                    )}
                </div>
            )}

            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-red-400 text-3xl font-black">{zones?.maxHR || '—'}</div>
                    <div className="text-slate-500 text-xs uppercase">Max Puls</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-blue-400 text-3xl font-black">{zones?.estimatedRestingHR || '—'}</div>
                    <div className="text-slate-500 text-xs uppercase">Vila Puls</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-amber-400 text-3xl font-black">{zones?.estimatedLTHR || '—'}</div>
                    <div className="text-slate-500 text-xs uppercase">LTHR</div>
                </div>
            </div>

            {/* Zone visualization */}
            {zones?.zones && (
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Träningszoner</h4>
                    {Object.entries(zones.zones).map(([key, zone], i) => (
                        <div key={key} className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded ${ZONE_COLORS[i]}`} />
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <span className="text-white text-sm font-medium">{zone.name}</span>
                                    <span className="text-slate-400 text-sm font-mono">{zone.min}-{zone.max} bpm</span>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                    <div
                                        className={`h-full ${ZONE_COLORS[i]}`}
                                        style={{ width: `${((zone.max - zone.min) / (zones.maxHR - (zones.estimatedRestingHR || 50))) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <button onClick={refresh} className="text-slate-400 text-xs hover:text-white">🔄 Skanna aktiviteter igen</button>
        </div>
    );
}
