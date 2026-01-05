import React from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import { useWeeklyPlanner } from '../../hooks/useWeeklyPlanner.ts';
import { PlannerConfigurator } from './PlannerConfigurator.tsx';
import { PlannerCalendar } from './PlannerCalendar.tsx';
import { DraggableActivityCard } from './DraggableActivityCard.tsx';
import { useData } from '../../context/DataContext.tsx';
import { ArrowLeft, Save, CheckCircle } from 'lucide-react';
import { getISODate } from '../../models/types.ts';

export function PlannerPage() {
    const navigate = useNavigate();
    const {
        config,
        setConfig,
        draftActivities,
        activeId,
        generateDraft,
        applySmartIncrease,
        dndHandlers
    } = useWeeklyPlanner();

    const { savePlannedActivities } = useData();
    const [saved, setSaved] = React.useState(false);

    // Week Logic: Plan for *Next Week* usually
    // Simple logic: Get next Monday
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7 || 7); // Calculate next Monday

    // Fallback: If it's Sunday, maybe user wants to plan *this coming* week (tomorrow).
    // If it's Monday, user might want to plan *this* week.
    // Let's stick to "Next Monday starts the week" for simplicity, or "This Monday" if we allow back-planning.
    // For MVP: Let's assume we are planning for the week starting "nextMonday".

    const activeItem = draftActivities.find(a => a.id === activeId);

    const handleSave = () => {
        const validActivities = draftActivities
            .filter(a => a.date && a.date !== 'UNASSIGNED')
            .map(a => ({
                ...a,
                status: 'PLANNED' as const
            }));

        savePlannedActivities(validActivities);
        setSaved(true);
        setTimeout(() => navigate('/dashboard'), 1000);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 relative overflow-hidden">
             {/* Header */}
             <div className="flex items-center justify-between mb-8 relative z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span className="font-bold text-sm">Tillbaka</span>
                </button>

                <div className="flex items-center gap-4">
                     <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">
                        Planerar vecka {getISODate(nextMonday)}
                     </span>
                     <button
                        onClick={handleSave}
                        disabled={saved || draftActivities.every(a => !a.date || a.date === 'UNASSIGNED')}
                        className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black py-2 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                     >
                        {saved ? <CheckCircle size={18} /> : <Save size={18} />}
                        {saved ? 'Sparat!' : 'Spara Vecka'}
                     </button>
                </div>
             </div>

             <DndContext {...dndHandlers}>
                <div className="grid grid-cols-12 gap-8 h-[calc(100vh-120px)]">
                    {/* Left Panel: Config */}
                    <div className="col-span-3 h-full overflow-y-auto pr-2 custom-scrollbar">
                        <PlannerConfigurator
                            config={config}
                            setConfig={setConfig}
                            onGenerate={generateDraft}
                            onSmartIncrease={applySmartIncrease}
                        />
                    </div>

                    {/* Right Panel: Calendar */}
                    <div className="col-span-9 h-full flex flex-col">
                        <PlannerCalendar
                            activities={draftActivities}
                            weekStartDate={nextMonday}
                        />
                    </div>
                </div>

                <DragOverlay>
                    {activeItem ? (
                        <div className="opacity-90 scale-105 cursor-grabbing">
                             <DraggableActivityCard activity={activeItem} />
                        </div>
                    ) : null}
                </DragOverlay>
             </DndContext>
        </div>
    );
}
