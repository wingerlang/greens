import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { getISODate, PlannedActivity } from "../../models/types.ts";
import { DraggableActivityCard } from "./DraggableActivityCard.tsx";

interface PlannerCalendarProps {
  activities: PlannedActivity[];
  weekStartDate: Date; // The Monday of the target week
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function PlannerCalendar(
  { activities, weekStartDate }: PlannerCalendarProps,
) {
  const unassignedActivities = activities.filter((a) =>
    !a.date || a.date === "UNASSIGNED"
  );

  // Create dates for the week
  const weekDates = DAYS.map((dayName, index) => {
    const d = new Date(weekStartDate);
    d.setDate(weekStartDate.getDate() + index);
    return {
      dayName,
      dateStr: getISODate(d),
      dayLabel: d.toLocaleDateString("sv-SE", {
        weekday: "short",
        day: "numeric",
      }),
    };
  });

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Unassigned Pool */}
      <DropZone
        id="UNASSIGNED"
        className="min-h-[120px] bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-3xl p-4 flex gap-4 overflow-x-auto items-center"
      >
        {unassignedActivities.length === 0
          ? (
            <div className="w-full text-center text-slate-500 text-xs italic">
              Genererade pass hamnar här. Dra dem till kalendern nedan.
            </div>
          )
          : (
            unassignedActivities.map((activity) => (
              <div key={activity.id} className="min-w-[160px]">
                <DraggableActivityCard activity={activity} />
              </div>
            ))
          )}
      </DropZone>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2 h-full">
        {weekDates.map((day) => {
          const dayActivities = activities.filter((a) =>
            a.date === day.dateStr
          );
          const totalDist = dayActivities.reduce(
            (sum, a) => sum + (a.estimatedDistance || 0),
            0,
          );
          const hasStrength = dayActivities.some((a) =>
            a.category === "STRENGTH"
          );

          return (
            <DropZone
              key={day.dateStr}
              id={day.dateStr}
              className={`
                                flex flex-col h-full bg-slate-900 border border-white/5 rounded-2xl p-2 transition-colors
                                ${
                totalDist > 0 || hasStrength ? "bg-slate-800/30" : ""
              }
                            `}
            >
              <div className="text-center mb-3 pb-2 border-b border-white/5">
                <span className="block text-[10px] font-black uppercase text-slate-500">
                  {day.dayName.substring(0, 3)}
                </span>
                <span className="block text-xs font-bold text-white">
                  {day.dateStr.slice(-2)}
                </span>
              </div>

              <div className="space-y-2 flex-1">
                {dayActivities.map((activity) => (
                  <DraggableActivityCard
                    key={activity.id}
                    activity={activity}
                    compact
                  />
                ))}
              </div>

              {/* Daily Summary */}
              {(totalDist > 0 || hasStrength) && (
                <div className="mt-2 pt-2 border-t border-white/5 text-[9px] font-bold text-center text-slate-400">
                  {totalDist > 0 && <span>{totalDist} km</span>}
                  {totalDist > 0 && hasStrength && <span>•</span>}
                  {hasStrength && <span>Styrka</span>}
                </div>
              )}
            </DropZone>
          );
        })}
      </div>
    </div>
  );
}

function DropZone(
  { id, children, className }: {
    id: string;
    children: React.ReactNode;
    className?: string;
  },
) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${
        isOver ? "ring-2 ring-indigo-500 bg-indigo-500/10" : ""
      }`}
    >
      {children}
    </div>
  );
}
