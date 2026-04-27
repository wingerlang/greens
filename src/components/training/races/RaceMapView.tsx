import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ExerciseEntry, PlannedActivity } from '../../../models/types.ts';
import { Map as MapIcon, Navigation, Target, History, Trophy, Calendar } from 'lucide-react';

interface RaceMapViewProps {
    races: ExerciseEntry[];
    upcomingRaces: PlannedActivity[];
    onSelectActivity?: (id: string) => void;
}

interface MapMarker {
    id: string;
    lat: number;
    lon: number;
    title: string;
    date: string;
    type: 'past' | 'upcoming';
    location: string;
    distance?: number;
    placement?: number;
}

import { geocodeLocation, normalizeLocation } from '../../../utils/geocoding.ts';

declare const L: any;

export function RaceMapView({ races, upcomingRaces, onSelectActivity }: RaceMapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMap = useRef<any>(null);
    const markersLayer = useRef<any>(null);
    const [markers, setMarkers] = useState<MapMarker[]>([]);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

    // Collect all unique locations
    const locationsToGeocode = useMemo(() => {
        const locs = new Map<string, { id: string, title: string, date: string, type: 'past' | 'upcoming', distance?: number, placement?: number }>();
        
        races.forEach(r => {
            if (r.location) {
                const key = r.location.toLowerCase().trim();
                // Prefer placing more recent or important races if overlapping?
                // For now, just keep them all or group by location
                locs.set(`${key}_past_${r.id}`, { 
                    id: r.id, 
                    title: r.title || r.notes || 'Tävling', 
                    date: r.date, 
                    type: 'past',
                    distance: r.distance,
                    placement: r.raceDetails?.placement
                });
            }
        });

        upcomingRaces.forEach(r => {
            if (r.location) {
                const key = r.location.toLowerCase().trim();
                locs.set(`${key}_upcoming_${r.id}`, { 
                    id: r.id, 
                    title: r.title || r.description || 'Planerad Tävling', 
                    date: r.date, 
                    type: 'upcoming',
                    distance: r.estimatedDistance
                });
            }
        });

        return locs;
    }, [races, upcomingRaces]);

    useEffect(() => {
        const performGeocoding = async () => {
            setIsGeocoding(true);
            const newMarkers: MapMarker[] = [];
            
            for (const [key, info] of locationsToGeocode.entries()) {
                // key is format: "city name_type_id"
                const parts = key.split('_');
                const rawLocation = parts[0].trim();
                
                const coords = await geocodeLocation(rawLocation);

                if (coords) {
                    const normalizedName = normalizeLocation(rawLocation);
                    newMarkers.push({
                        id: info.id,
                        lat: coords[0],
                        lon: coords[1],
                        title: info.title,
                        date: info.date,
                        type: info.type,
                        location: normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1),
                        distance: info.distance,
                        placement: info.placement
                    });
                }
            }

            setMarkers(newMarkers);
            setIsGeocoding(false);
        };

        performGeocoding();
    }, [locationsToGeocode]);

    useEffect(() => {
        if (!mapRef.current || typeof L === 'undefined') return;

        if (!leafletMap.current) {
            leafletMap.current = L.map(mapRef.current, {
                center: [59.3293, 18.0686],
                zoom: 5,
                zoomControl: false,
                attributionControl: false
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19
            }).addTo(leafletMap.current);

            L.control.zoom({ position: 'bottomright' }).addTo(leafletMap.current);
            
            markersLayer.current = L.layerGroup().addTo(leafletMap.current);
        }

        markersLayer.current.clearLayers();

        if (markers.length > 0) {
            const bounds = L.latLngBounds([]);
            
            markers.forEach(m => {
                const color = m.type === 'upcoming' ? '#fbbe24' : '#10b981'; // Amber for upcoming, Emerald for past
                
                const icon = L.divIcon({
                    className: 'custom-map-marker',
                    html: `
                        <div style="
                            width: 14px; 
                            height: 14px; 
                            background: ${color}; 
                            border: 3px solid rgba(0,0,0,0.5); 
                            border-radius: 50%; 
                            box-shadow: 0 0 15px ${color}80;
                            cursor: pointer;
                        "></div>
                    `,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });

                const marker = L.marker([m.lat, m.lon], { icon }).addTo(markersLayer.current);
                
                marker.on('click', () => {
                    setSelectedMarker(m);
                });

                bounds.extend([m.lat, m.lon]);
            });

            if (markers.length > 1) {
                leafletMap.current.fitBounds(bounds, { padding: [50, 50] });
            } else if (markers.length === 1) {
                leafletMap.current.setView([markers[0].lat, markers[0].lon], 10);
            }
        }

        return () => {
            // Cleanup on unmount handled by refs
        };
    }, [markers]);

    return (
        <div className="relative w-full h-[600px] bg-slate-950 rounded-[32px] overflow-hidden border border-white/5 shadow-2xl">
            {/* Map Container */}
            <div ref={mapRef} className="w-full h-full z-0" />

            {/* Overlays */}
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl">
                    <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest">
                        <MapIcon className="text-amber-500" size={16} /> Tävlingskarta
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">
                        {markers.length} platser identifierade
                    </p>
                </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-6 left-6 z-10">
                <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-xl space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-black text-slate-300 uppercase">Kommande</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black text-slate-300 uppercase">Genomförda</span>
                    </div>
                </div>
            </div>

            {/* Selected Marker Detail Card */}
            {selectedMarker && (
                <div className="absolute top-6 right-6 z-10 w-72 animate-in slide-in-from-right-4 fade-in duration-300">
                    <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                        <div className={`h-1.5 w-full ${selectedMarker.type === 'upcoming' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between items-start gap-3">
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                        {selectedMarker.type === 'upcoming' ? 'Kommande Mål' : 'Resultat'}
                                    </p>
                                    <h4 className="text-sm font-black text-white leading-tight">{selectedMarker.title}</h4>
                                </div>
                                <button 
                                    onClick={() => setSelectedMarker(null)}
                                    className="text-slate-500 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Calendar size={10} />
                                        <span className="text-[9px] font-black uppercase">Datum</span>
                                    </div>
                                    <p className="text-xs font-bold text-white">{selectedMarker.date}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Navigation size={10} />
                                        <span className="text-[9px] font-black uppercase">Plats</span>
                                    </div>
                                    <p className="text-xs font-bold text-white">{selectedMarker.location}</p>
                                </div>
                                {selectedMarker.distance && (
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                            <Target size={10} />
                                            <span className="text-[9px] font-black uppercase">Distans</span>
                                        </div>
                                        <p className="text-xs font-bold text-white">{selectedMarker.distance.toFixed(1)} km</p>
                                    </div>
                                )}
                                {selectedMarker.placement && (
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                            <Trophy size={10} />
                                            <span className="text-[9px] font-black uppercase">Placering</span>
                                        </div>
                                        <p className="text-xs font-bold text-emerald-400">#{selectedMarker.placement}</p>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => onSelectActivity?.(selectedMarker.id)}
                                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 transition-all active:scale-[0.98]"
                            >
                                Visa Detaljer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Indicator */}
            {isGeocoding && (
                <div className="absolute inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                        <div className="text-center">
                            <p className="text-sm font-black text-white uppercase tracking-widest">Hämtar kartdata</p>
                            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Geokodar tävlingsplatser...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
