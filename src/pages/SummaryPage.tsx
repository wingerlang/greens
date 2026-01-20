import React, { useState, useRef, useMemo } from 'react';
import { useTrainingSummary } from '../hooks/useTrainingSummary.ts';
import { SummaryCard } from '../components/summary/SummaryCard.tsx';
import { SummaryVsCard } from '../components/summary/SummaryVsCard.tsx';
import { SummaryControls } from '../components/summary/SummaryControls.tsx';
import html2canvas from 'html2canvas';

export function SummaryPage() {
    // Default to "Year to Date"
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(0, 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [showPrs, setShowPrs] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [viewMode, setViewMode] = useState<'single' | 'vs'>('single');

    const { stats } = useTrainingSummary(startDate, endDate);

    // Calculate same period last year
    const prevStartDate = useMemo(() => {
        const d = new Date(startDate);
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().split('T')[0];
    }, [startDate]);

    const prevEndDate = useMemo(() => {
        const d = new Date(endDate);
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().split('T')[0];
    }, [endDate]);

    const { stats: prevStats } = useTrainingSummary(prevStartDate, prevEndDate);

    const cardRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsDownloading(true);
        try {
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: '#020617', // slate-950
                scale: 2, // High res
                logging: false,
                useCORS: true
            });

            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = `Greens_Summary_${viewMode === 'vs' ? 'VS_' : ''}${startDate}_${endDate}.png`;
            link.click();
        } catch (err) {
            console.error('Failed to generate summary image', err);
            alert('Kunde inte skapa bilden. Försök igen.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 animate-in fade-in duration-700">
            <header className="mb-8">
                <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                    Dina Höjdpunkter
                </h1>
                <p className="text-slate-400 font-bold max-w-2xl">
                    Skapa en snygg sammanfattning av din träning att dela med vänner.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Controls - Left Side */}
                <div className="lg:col-span-1">
                    <SummaryControls
                        startDate={startDate}
                        endDate={endDate}
                        onDateChange={(s, e) => {
                            setStartDate(s);
                            setEndDate(e);
                        }}
                        showPrs={showPrs}
                        onTogglePrs={setShowPrs}
                        onDownload={handleDownload}
                        isDownloading={isDownloading}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                    />
                </div>

                {/* Preview - Right Side / Center */}
                <div className="lg:col-span-2 flex flex-col items-center justify-center bg-slate-900/20 rounded-3xl border border-white/5 p-8 min-h-[800px]">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">Förhandsgranskning</p>

                    {/* The Card Wrapper to capture */}
                    <div className="shadow-2xl shadow-black/50 overflow-hidden rounded-none">
                        <div ref={cardRef}>
                            {viewMode === 'vs' ? (
                                <SummaryVsCard
                                    stats={stats}
                                    prevStats={prevStats}
                                    startDate={startDate}
                                    endDate={endDate}
                                    prevStartDate={prevStartDate}
                                    prevEndDate={prevEndDate}
                                />
                            ) : (
                                <SummaryCard
                                    stats={stats}
                                    startDate={startDate}
                                    endDate={endDate}
                                    showPrs={showPrs}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
