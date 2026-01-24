import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { formatActivityDuration } from "../../utils/formatters.ts";
import { EXERCISE_TYPES } from "../training/ExerciseModal.tsx";

interface DayHoverCardProps {
  date: string;
  activities: any[];
  nutrition: any;
  onActivityClick: (actId: string) => void;
}

export const DayHoverCard = ({
  date,
  activities,
  nutrition,
  onActivityClick,
}: DayHoverCardProps) => {
  const navigate = useNavigate();
  const dayName = new Date(date).toLocaleDateString("sv-SE", {
    weekday: "long",
  });
  const formattedDate = new Date(date).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
      {/* Header */}
      <div className="p-3 bg-slate-800/50 border-b border-slate-700/50 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
            {dayName}
          </span>
          <span className="text-xs font-bold text-white">{formattedDate}</span>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black text-slate-500 uppercase">
            Energi
          </div>
          <div className="text-xs font-black text-emerald-400">
            {Math.round(nutrition.calories)} kcal
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Activities */}
        {activities.length > 0
          ? (
            <div className="space-y-1.5">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">
                Träning
              </div>
              <div className="space-y-1">
                {activities.map((act) => {
                  const typeDef = EXERCISE_TYPES.find((t) =>
                    t.type === act.type
                  );
                  return (
                    <div
                      key={act.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onActivityClick(act.id);
                      }}
                      className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-colors cursor-pointer group"
                    >
                      <div className="text-sm">{typeDef?.icon || "💪"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-slate-200 truncate group-hover:text-white">
                          {typeDef?.label || act.type}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {formatActivityDuration(act.durationMinutes)}{" "}
                          {act.distance ? `• ${act.distance} km` : ""}
                        </div>
                      </div>
                      <ChevronRight
                        size={10}
                        className="text-slate-600 group-hover:text-white"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )
          : (
            <div className="text-center py-2">
              <span className="text-[10px] text-slate-600 italic">
                Ingen träning loggad
              </span>
            </div>
          )}

        {/* Nutrition Summary (Mini) */}
        <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-700/50">
          <div className="text-center">
            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
              Prot
            </div>
            <div className="text-[10px] font-black text-rose-400">
              🌱 {Math.round(nutrition.protein)}g
            </div>
          </div>
          <div className="text-center border-l border-slate-700/50">
            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
              Kolh
            </div>
            <div className="text-[10px] font-black text-blue-400">
              {Math.round(nutrition.carbs)}g
            </div>
          </div>
          <div className="text-center border-l border-slate-700/50">
            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
              Fett
            </div>
            <div className="text-[10px] font-black text-amber-400">
              {Math.round(nutrition.fat)}g
            </div>
          </div>
        </div>
      </div>

      {/* Footer Link */}
      <div
        onClick={() => navigate(`/calories?date=${date}`)}
        className="bg-slate-800/80 p-2 text-center border-t border-slate-700/50 hover:bg-indigo-600 transition-colors cursor-pointer group/footer"
      >
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/footer:text-white flex items-center justify-center gap-1">
          Se Detaljer <ChevronRight size={10} />
        </div>
      </div>
    </div>
  );
};
