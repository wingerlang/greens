import React from 'react';
import { Dumbbell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TrainingCardProps {
    trainingContent: React.ReactNode;
    density: 'compact' | 'slim' | 'normal';
}

export const TrainingCard: React.FC<TrainingCardProps> = ({ trainingContent, density }) => {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => navigate('/training')}
            className={`w-full ${density === 'compact' ? 'p-1.5 gap-2 rounded-xl' : density === 'slim' ? 'p-3 gap-3 rounded-2xl' : 'p-6 gap-4 rounded-3xl'} shadow-sm border border-slate-100 dark:border-slate-800 flex items-start hover:scale-[1.01] transition-transform cursor-pointer group bg-white dark:bg-slate-900 h-full`}
        >
            <div className={`${density === 'compact' ? 'w-8 h-8' : 'w-14 h-14'} bg-[#DCFCE7] dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 transition-colors shrink-0`}>
                <Dumbbell className={density === 'compact' ? 'w-4 h-4' : 'w-7 h-7'} />
            </div>
            <div className="flex-1 min-w-0 text-left">
                <div className={`${density === 'compact' ? 'text-[10px]' : 'text-sm'} text-slate-500 dark:text-slate-400 font-semibold mb-1`}>Dagens träning</div>
                <div className="w-full">{trainingContent}</div>
            </div>
        </div>
    );
};
