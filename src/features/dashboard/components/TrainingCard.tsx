import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Dumbbell, X } from "lucide-react";
import { DashboardCardWrapper } from "../../../components/dashboard/DashboardCardWrapper.tsx";
import { EXERCISE_TYPES } from "../../../components/training/ExerciseModal.tsx";
import { ExerciseEntry, PlannedActivity } from "../../../models/types.ts";

interface TrainingCardProps {
  isDone: boolean;
  onToggle: (id: string, e: React.MouseEvent) => void;
  density: string;
  completedTraining: ExerciseEntry[];
  todaysPlan?: PlannedActivity;
  deleteExercise: (id: string) => void;
  isHoveringTraining: boolean;
  settings: { dailyTrainingGoal?: number };
}

export const TrainingCard: React.FC<TrainingCardProps> = ({
  isDone,
  onToggle,
  density,
  completedTraining,
  todaysPlan,
  deleteExercise,
  isHoveringTraining,
  settings,
}) => {
  const navigate = useNavigate();
  const totalCalories = completedTraining.reduce(
    (sum, act) => sum + act.caloriesBurned,
    0,
  );

  // Determine content
  let trainingContent;
  if (completedTraining.length > 0) {
    const totalDuration = completedTraining.reduce(
      (sum, act) => sum + act.durationMinutes,
      0,
    );
    const totalDistance = completedTraining.reduce(
      (sum, act) => sum + (act.distance || 0),
      0,
    );
    const totalTonnage = completedTraining.reduce(
      (sum, act) => sum + (act.tonnage || 0),
      0,
    );
    const totalSessions = completedTraining.length;
    const totalSets = completedTraining.reduce(
      (sum, act) => sum + (act.totalSets || 0),
      0,
    );
    const totalReps = completedTraining.reduce(
      (sum, act) => sum + (act.totalReps || 0),
      0,
    );
    const goalMet = totalDuration >= (settings.dailyTrainingGoal || 60);

    trainingContent = (
      <div
        className={`flex flex-col ${
          density === "compact"
            ? "gap-0.5 w-full p-1"
            : density === "slim"
            ? "gap-1.5 w-full p-2"
            : "gap-2 w-full p-3"
        } rounded-2xl transition-colors ${
          goalMet ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""
        }`}
      >
        <div className="flex flex-wrap justify-between items-center gap-2 mb-0.5 px-0.5">
          <div className="text-[9px] font-bold uppercase text-slate-400">
            Dagens Totalt
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <span className="font-bold text-slate-900 dark:text-white">
              {Math.round(totalDuration)} min
            </span>
            <span className="opacity-20 text-slate-300">|</span>
            <span>{totalSessions} {totalSessions === 1 ? "pass" : "pass"}</span>
            {totalDistance > 0 && (
              <>
                <span className="opacity-20 text-slate-300">|</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {totalDistance.toFixed(1)} km
                </span>
              </>
            )}
            {totalSets > 0 && (
              <>
                <span className="opacity-20 text-slate-300">|</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {totalSets} set
                </span>
              </>
            )}
            {totalReps > 0 && (
              <>
                <span className="opacity-20 text-slate-300">|</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {totalReps} reps
                </span>
              </>
            )}
            {totalTonnage > 0 && (
              <>
                <span className="opacity-20 text-slate-300">|</span>
                <span className="text-purple-600 dark:text-purple-400 font-bold">
                  {(totalTonnage / 1000).toFixed(1)} ton
                </span>
              </>
            )}
          </div>
        </div>

        {completedTraining.map((act) => {
          const typeDef = EXERCISE_TYPES.find((t) => t.type === act.type);

          const metricParts = [];
          metricParts.push(`${Math.round(act.durationMinutes)} min`);

          if (act.caloriesBurned > 0) {
            metricParts.push(
              `<span class="text-rose-500 font-bold">${act.caloriesBurned} kcal</span>`,
            );
          }

          if (act.distance) {
            if (act.type === "running") {
              const pace = act.durationMinutes / act.distance;
              const paceMin = Math.floor(pace);
              const paceSec = Math.round((pace - paceMin) * 60);
              const paceStr = `${paceMin}:${
                paceSec.toString().padStart(2, "0")
              }`;
              metricParts.push(`${act.distance} km (${paceStr}/km)`);
            } else {
              metricParts.push(`${act.distance} km`);
            }
          }

          if (act.totalSets) metricParts.push(`${act.totalSets} set`);
          if (act.totalReps) metricParts.push(`${act.totalReps} reps`);
          if (act.tonnage) {
            metricParts.push(`${(act.tonnage / 1000).toFixed(1)} ton`);
          }

          let hrString = "";
          if (act.heartRateAvg) {
            hrString = `HR ${act.heartRateAvg}`;
            if (act.heartRateMax) hrString += `/${act.heartRateMax}`;
          }

          return (
            <div
              key={act.id}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/logg?activityId=${act.id}`);
              }}
              className={`flex items-center ${
                density === "compact"
                  ? "gap-1.5 p-1 rounded-lg"
                  : "gap-2 p-2 rounded-xl"
              } group/item cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all border ${
                isHoveringTraining
                  ? "border-emerald-500 bg-emerald-500/5 shadow-md -translate-y-[1px]"
                  : "border-transparent"
              } hover:border-slate-100 dark:hover:border-slate-700 hover:shadow-sm relative bg-white/40 dark:bg-slate-900/40`}
            >
              <div
                className={`${
                  density === "compact" ? "text-sm p-1" : "text-lg p-1.5"
                } bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50`}
              >
                {typeDef?.icon || "💪"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 dark:text-white leading-tight capitalize flex items-center gap-1.5 truncate">
                  {typeDef?.label || act.type}
                  {hrString && (
                    <span className="text-[8px] font-black text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-1 py-0.5 rounded tracking-wide">
                      {hrString}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-medium flex flex-wrap gap-x-1 items-center">
                  {metricParts.map((part, i) => (
                    <React.Fragment key={i}>
                      <span dangerouslySetInnerHTML={{ __html: part }} />
                      {i < metricParts.length - 1 && (
                        <span className="opacity-30">•</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Ta bort aktivitet?")) {
                      deleteExercise(act.id);
                    }
                  }}
                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors"
                >
                  <X size={14} />
                </button>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            </div>
          );
        })}
      </div>
    );
  } else if (todaysPlan) {
    let icon = "📅";
    let label = todaysPlan.type as string;

    if (todaysPlan.type === "RUN") {
      const runDef = EXERCISE_TYPES.find((t) => t.type === "running");
      icon = runDef?.icon || "🏃";
      label = "Löpning";
    }

    trainingContent = (
      <div className="flex items-center gap-4 opacity-75">
        <div className="text-2xl grayscale">{icon}</div>
        <div>
          <div className="font-bold text-slate-900 dark:text-white leading-tight">
            Planerat: {label}
          </div>
          <div className="text-xs text-slate-500 font-medium italic">
            {todaysPlan.estimatedDistance
              ? `${todaysPlan.estimatedDistance} km`
              : "Dagens pass"}
            {todaysPlan.category ? ` • ${todaysPlan.category}` : ""}
          </div>
        </div>
      </div>
    );
  } else {
    trainingContent = (
      <div>
        <div className="font-bold text-slate-900 dark:text-white">Vila</div>
        <div className="text-xs text-slate-500">Ingen planerad träning</div>
      </div>
    );
  }

  return (
    <DashboardCardWrapper
      id="training"
      isDone={isDone}
      onToggle={onToggle}
      className="md:col-span-12 xl:col-span-6 h-full"
    >
      <div
        onClick={() => navigate("/planera")}
        className={`w-full ${
          density === "compact"
            ? "p-1.5 gap-2 rounded-xl"
            : density === "slim"
            ? "p-3 gap-3 rounded-2xl"
            : "p-6 gap-4 rounded-3xl"
        } shadow-sm border border-slate-100 dark:border-slate-800 flex items-start hover:scale-[1.01] transition-transform cursor-pointer group bg-white dark:bg-slate-900 h-full relative overflow-hidden`}
      >
        <Dumbbell className="absolute -bottom-4 -right-4 w-24 h-24 text-emerald-500/5 dark:text-emerald-400/10 pointer-events-none transform -rotate-12 transition-all group-hover:scale-110" />

        <div
          className={`${
            density === "compact" ? "w-8 h-8" : "w-14 h-14"
          } bg-[#DCFCE7] dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 transition-colors shrink-0 z-10`}
        >
          <Dumbbell className={density === "compact" ? "w-4 h-4" : "w-7 h-7"} />
        </div>
        <div className="flex-1 min-w-0 text-left z-10">
          <div
            className={`${
              density === "compact" ? "text-[10px]" : "text-sm"
            } text-slate-500 dark:text-slate-400 font-semibold mb-1 flex items-center justify-between`}
          >
            <span>Dagens träning</span>
            {totalCalories > 0 && (
              <span className="text-rose-500 font-black animate-in fade-in slide-in-from-right-2">
                -{totalCalories} kcal
              </span>
            )}
          </div>
          <div className="w-full">{trainingContent}</div>
        </div>
      </div>
    </DashboardCardWrapper>
  );
};
