import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DayHoverCard } from "../../../components/dashboard/DayHoverCard.tsx";

interface WeeklyTimelineProps {
  density: string;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  unifiedActivities: any[];
  dailyVitals: any;
  calculateDailyNutrition: (date: string) => any;
  calculateTrainingStreak: (date: string, type?: string) => number;
  calculateWeeklyTrainingStreak: (date: string) => number;
  onHoverChange?: (isHovering: boolean) => void;
}

export const WeeklyTimeline: React.FC<WeeklyTimelineProps> = ({
  density,
  selectedDate,
  setSelectedDate,
  unifiedActivities,
  dailyVitals,
  calculateDailyNutrition,
  calculateTrainingStreak,
  calculateWeeklyTrainingStreak,
  onHoverChange,
}) => {
  const navigate = useNavigate();
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  return (
    <div
      className="col-span-1 md:col-span-12 relative z-[60]"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <div
        className={`w-full ${
          density === "compact" ? "p-4" : "p-6"
        } bg-slate-900 rounded-2xl border border-slate-800 transition-all duration-300`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              Senaste 7 Dagarna
            </h3>

            {/* Date Context Highlight */}
            {(() => {
              const now = new Date();
              const sel = new Date(selectedDate);
              const diffTime = sel.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              let label = "";
              if (selectedDate === now.toISOString().split("T")[0]) {label =
                  "IDAG";} else if (diffDays === 0) label = "IDAG"; // Fallback
              else if (diffDays === 1) label = "IMORGON";
              else if (diffDays === -1) label = "IGÅR";
              else label = selectedDate;

              return label
                ? (
                  <span className="ml-2 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 text-[9px] font-bold uppercase tracking-wider border border-indigo-500/20">
                    {label}
                  </span>
                )
                : null;
            })()}
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">
                Träning
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-600"></div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">
                Idag
              </span>
            </div>
          </div>
        </div>

        {/* Horizontal Timeline */}
        {(() => {
          // Rolling window ending on SELECTED DATE
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split("T")[0];
          });

          const dayLabels = ["SÖN", "MÅN", "TIS", "ONS", "TORS", "FRE", "LÖR"];

          // Calculate totals
          let totalMinutes = 0;
          let totalTonnage = 0;
          let totalDistance = 0;
          let cardioCount = 0;
          let strengthCount = 0;

          days.forEach((date) => {
            const dayActivities = unifiedActivities.filter((a) =>
              a.date === date
            );
            dayActivities.forEach((a) => {
              totalMinutes += a.durationMinutes || 0;
              totalTonnage += (a.tonnage || 0) / 1000;
              totalDistance += a.distance || 0;
              if (a.type === "strength") strengthCount++;
              else cardioCount++;
            });
          });

          const totalMinsRounded = Math.round(totalMinutes);
          const totalHours = Math.floor(totalMinsRounded / 60);
          const remainingMins = totalMinsRounded % 60;
          const completedWorkouts = cardioCount + strengthCount;

          return (
            <>
              {/* Timeline Row */}
              <div className="flex items-end justify-between mb-8 relative h-32 px-2">
                {/* Baseline */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-700">
                </div>

                {days.map((date, i) => {
                  const d = new Date(date);
                  const dayOfWeek = d.getDay();
                  // Check against SELECTED DATE for visual marker
                  const isSelected = date === selectedDate;
                  const isToday =
                    date === new Date().toISOString().split("T")[0];

                  const dayActivities = unifiedActivities.filter((a) =>
                    a.date === date
                  );
                  const hasTraining = dayActivities.length > 0;
                  const isIncomplete = dailyVitals[date]?.incomplete;

                  // Calculate bar height based on duration (max 100px)
                  const totalDuration = dayActivities.reduce(
                    (sum, a) => sum + (a.durationMinutes || 0),
                    0,
                  );
                  const barHeight = Math.min(Math.max(totalDuration, 4), 100); // Min 4px visibility

                  return (
                    <div
                      key={date}
                      className={`flex-1 flex flex-col items-center justify-end h-full cursor-pointer relative z-10 group transition-all duration-300 ${
                        hoveredDay && hoveredDay !== date
                          ? "blur-[1px] opacity-40 scale-[0.98]"
                          : "blur-0 opacity-100 scale-100"
                      }`}
                      onMouseEnter={() => setHoveredDay(date)}
                      onMouseLeave={() => setHoveredDay(null)}
                      onClick={() => setSelectedDate(date)}
                    >
                      {hoveredDay === date && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[100]">
                          <DayHoverCard
                            date={date}
                            activities={dayActivities}
                            nutrition={calculateDailyNutrition(date)}
                            onActivityClick={(id) =>
                              navigate(`/logg?activityId=${id}`)}
                          />
                        </div>
                      )}

                      {/* Activity Bar */}
                      {hasTraining
                        ? (
                          <div
                            className={`w-2 md:w-3 rounded-full mb-2 transition-all duration-300 ${
                              dayActivities.some((a) => a.type === "strength")
                                ? "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]"
                                : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                            } ${hoveredDay === date ? "scale-110" : ""}`}
                            style={{ height: `${barHeight}%` }}
                          >
                          </div>
                        )
                        : <div className="mb-2"></div>}

                      {/* Day Label & Marker */}
                      <div className="flex flex-col items-center gap-1 mb-2">
                        {isIncomplete && (
                          <div
                            className="w-1 h-1 rounded-full bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.6)] animate-pulse absolute -top-2"
                            title="Ej fullständigt loggad dag"
                          />
                        )}

                        <div
                          className={`relative px-2 py-1 rounded-lg transition-colors ${
                            isSelected
                              ? "bg-slate-800 border border-slate-700"
                              : "hover:bg-slate-800/50"
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold ${
                              isSelected
                                ? "text-white"
                                : isToday
                                ? "text-indigo-400"
                                : "text-slate-500"
                            }`}
                          >
                            {dayLabels[dayOfWeek]}
                          </span>
                          {isSelected && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500">
                            </div>
                          )}
                        </div>
                      </div>

                      {/* No "Plupp" - clean baseline */}
                    </div>
                  );
                })}
              </div>

              {/* Stats Row - Responsive Grid */}
              <div className="grid grid-cols-2 gap-y-6 md:flex md:items-center md:justify-between px-2 mt-4">
                {/* Total Tid */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Total Tid
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-white">
                    {totalHours}h {remainingMins}m
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {completedWorkouts} Slutförda pass
                  </div>
                </div>

                {/* Volym */}
                <div className="space-y-1 md:border-l md:border-slate-800 md:pl-8">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Volym
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-emerald-400">
                    {totalTonnage.toFixed(1)}{" "}
                    <span className="text-sm text-slate-500">Ton</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Styrketräning
                  </div>
                </div>

                {/* Distans */}
                <div className="space-y-1 md:border-l md:border-slate-800 md:pl-8">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Distans
                  </div>
                  <div className="text-2xl md:text-3xl font-black text-indigo-400">
                    {totalDistance.toFixed(1)}{" "}
                    <span className="text-sm text-slate-500">Km</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Löpning / Gång
                  </div>
                </div>

                {/* NEW: Streak Split */}
                <div className="space-y-1 md:border-l md:border-slate-800 md:pl-8">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Träningsstreak
                  </div>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-14">
                        Styrka
                      </span>
                      <span className="text-sm font-black text-white">
                        {calculateTrainingStreak(selectedDate, "strength")}{" "}
                        dagar
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-14">
                        Kondition
                      </span>
                      <span className="text-sm font-black text-white">
                        {calculateTrainingStreak(selectedDate, "running")} dagar
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {calculateWeeklyTrainingStreak(selectedDate)}{" "}
                    veckor i rad (totalt)
                  </div>
                </div>

                {/* Typ */}
                <div className="space-y-2 border-l border-slate-800 pl-8 hidden md:block">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Typ
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    <span className="text-xs text-slate-300">
                      Kondition {completedWorkouts > 0
                        ? Math.round((cardioCount / completedWorkouts) * 100)
                        : 0}%
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({cardioCount} pass)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-xs text-slate-300">
                      Styrka {completedWorkouts > 0
                        ? Math.round((strengthCount / completedWorkouts) * 100)
                        : 0}%
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({strengthCount} pass)
                    </span>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};
