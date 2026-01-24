import React, { useMemo } from "react";
import type { BackupSnapshot } from "../../../models/backup.ts";
import { backupService } from "../../../services/backupService.ts";

interface TimelineGraphProps {
  snapshots: BackupSnapshot[];
  onSelectSnapshot: (snapshot: BackupSnapshot) => void;
  selectedId?: string;
}

export function TimelineGraph(
  { snapshots, onSelectSnapshot, selectedId }: TimelineGraphProps,
) {
  // Group snapshots by date for the timeline
  const timelineData = useMemo(() => {
    if (snapshots.length === 0) return { days: [], maxCount: 0, maxSize: 0 };

    // Get date range (last 30 days)
    const now = new Date();
    const days: {
      date: string;
      snapshots: BackupSnapshot[];
      totalSize: number;
    }[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      const daySnapshots = snapshots.filter((s) =>
        s.timestamp.startsWith(dateStr)
      );
      days.push({
        date: dateStr,
        snapshots: daySnapshots,
        totalSize: daySnapshots.reduce((sum, s) => sum + s.size, 0),
      });
    }

    const maxCount = Math.max(...days.map((d) => d.snapshots.length), 1);
    const maxSize = Math.max(...days.map((d) => d.totalSize), 1);

    return { days, maxCount, maxSize };
  }, [snapshots]);

  // Storage trend data (cumulative)
  const storageTrend = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let cumulative = 0;
    return sorted.map((s) => {
      cumulative += s.size;
      return { timestamp: s.timestamp, size: cumulative };
    });
  }, [snapshots]);

  const maxCumulativeSize = storageTrend.length > 0
    ? storageTrend[storageTrend.length - 1].size
    : 0;

  if (snapshots.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-sm text-slate-500">
          Skapa några backups för att se tidslinjen
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Backup Frequency Timeline */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Backup-aktivitet</h3>
            <p className="text-[10px] text-slate-500">Senaste 30 dagarna</p>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              <span className="text-slate-500">Backups</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-slate-500">Storlek</span>
            </div>
          </div>
        </div>

        {/* Timeline Bars */}
        <div className="flex items-end gap-1 h-32">
          {timelineData.days.map((day, i) => {
            const barHeight = day.snapshots.length > 0
              ? Math.max(
                10,
                (day.snapshots.length / timelineData.maxCount) * 100,
              )
              : 0;
            const sizeHeight = day.totalSize > 0
              ? Math.max(5, (day.totalSize / timelineData.maxSize) * 100)
              : 0;

            const isToday = day.date === new Date().toISOString().split("T")[0];
            const hasSnapshots = day.snapshots.length > 0;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-0.5 group relative"
              >
                {/* Tooltip */}
                {hasSnapshots && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] whitespace-nowrap shadow-xl">
                      <div className="font-bold text-white">{day.date}</div>
                      <div className="text-slate-400">
                        {day.snapshots.length}{" "}
                        backup{day.snapshots.length > 1 ? "s" : ""}
                      </div>
                      <div className="text-emerald-400">
                        {backupService.formatBytes(day.totalSize)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Backup count bar */}
                <div
                  className={`w-full rounded-t transition-all duration-300 cursor-pointer ${
                    hasSnapshots
                      ? "bg-indigo-500/80 hover:bg-indigo-400"
                      : "bg-slate-800/50"
                  }`}
                  style={{
                    height: `${barHeight}%`,
                    minHeight: hasSnapshots ? "4px" : "2px",
                  }}
                  onClick={() =>
                    hasSnapshots && onSelectSnapshot(day.snapshots[0])}
                />

                {/* Size indicator (overlay) */}
                {sizeHeight > 0 && (
                  <div
                    className="absolute bottom-0 w-1 bg-emerald-500/60 rounded-full"
                    style={{ height: `${sizeHeight}%` }}
                  />
                )}

                {/* Today marker */}
                {isToday && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-indigo-400">
                    IDAG
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Date labels */}
        <div className="flex justify-between mt-6 text-[9px] text-slate-600">
          <span>{timelineData.days[0]?.date.slice(5)}</span>
          <span>{timelineData.days[14]?.date.slice(5)}</span>
          <span>Idag</span>
        </div>
      </div>

      {/* Storage Trend Chart */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Lagringsanvändning</h3>
            <p className="text-[10px] text-slate-500">
              Kumulativ storlek över tid
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-black text-emerald-400">
              {backupService.formatBytes(maxCumulativeSize)}
            </div>
            <div className="text-[10px] text-slate-500">Total</div>
          </div>
        </div>

        {/* Area Chart */}
        <div className="relative h-24">
          <svg className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="storageGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="rgb(16, 185, 129)"
                  stopOpacity="0.4"
                />
                <stop
                  offset="100%"
                  stopColor="rgb(16, 185, 129)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {storageTrend.length > 1 && (
              <>
                {/* Area fill */}
                <path
                  d={`
                                        M 0 100
                                        ${
                    storageTrend.map((point, i) => {
                      const x = (i / (storageTrend.length - 1)) * 100;
                      const y = 100 - (point.size / maxCumulativeSize) * 100;
                      return `L ${x} ${y}`;
                    }).join(" ")
                  }
                                        L 100 100
                                        Z
                                    `}
                  fill="url(#storageGradient)"
                />

                {/* Line */}
                <path
                  d={`
                                        M ${0} ${
                    100 - (storageTrend[0].size / maxCumulativeSize) * 100
                  }
                                        ${
                    storageTrend.slice(1).map((point, i) => {
                      const x = ((i + 1) / (storageTrend.length - 1)) * 100;
                      const y = 100 - (point.size / maxCumulativeSize) * 100;
                      return `L ${x} ${y}`;
                    }).join(" ")
                  }
                                    `}
                  fill="none"
                  stroke="rgb(16, 185, 129)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Points */}
                {storageTrend.map((point, i) => {
                  const x = (i / (storageTrend.length - 1)) * 100;
                  const y = 100 - (point.size / maxCumulativeSize) * 100;
                  return (
                    <circle
                      key={i}
                      cx={`${x}%`}
                      cy={`${y}%`}
                      r="3"
                      fill="rgb(16, 185, 129)"
                      className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    />
                  );
                })}
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Backup Heatmap (Activity Grid) */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Aktivitetskarta</h3>
            <p className="text-[10px] text-slate-500">
              Backup-frekvens per dag
            </p>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {/* Day labels */}
          {["M", "T", "O", "T", "F", "L", "S"].map((day, i) => (
            <div key={i} className="text-center text-[9px] text-slate-600 py-1">
              {day}
            </div>
          ))}

          {/* Heatmap cells - last 35 days arranged by weekday */}
          {Array.from({ length: 35 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (34 - i));
            const dateStr = d.toISOString().split("T")[0];
            const dayData = timelineData.days.find((day) =>
              day.date === dateStr
            );
            const count = dayData?.snapshots.length || 0;

            const intensity = count === 0 ? 0 : Math.min(count / 3, 1);
            const bgColor = count === 0 ? "bg-slate-800/30" : `bg-indigo-500`;

            return (
              <div
                key={i}
                className={`aspect-square rounded-sm ${bgColor} transition-all hover:ring-2 hover:ring-indigo-400/50 cursor-pointer`}
                style={{ opacity: count === 0 ? 0.3 : 0.3 + intensity * 0.7 }}
                title={`${dateStr}: ${count} backup${count !== 1 ? "s" : ""}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-4 text-[9px] text-slate-500">
          <span>Färre</span>
          <div className="flex gap-0.5">
            {[0.2, 0.4, 0.6, 0.8, 1].map((opacity, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-sm bg-indigo-500"
                style={{ opacity }}
              />
            ))}
          </div>
          <span>Fler</span>
        </div>
      </div>

      {/* Recent Backups Quick List */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h3 className="text-sm font-bold text-white mb-4">Senaste backups</h3>
        <div className="space-y-2">
          {snapshots.slice(0, 5).map((snapshot) => (
            <button
              key={snapshot.id}
              onClick={() => onSelectSnapshot(snapshot)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                selectedId === snapshot.id
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-white/5 bg-white/[0.02] hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    snapshot.trigger === "MANUAL"
                      ? "bg-blue-500"
                      : snapshot.trigger === "PRE_RESTORE"
                      ? "bg-amber-500"
                      : "bg-slate-500"
                  }`}
                />
                <div>
                  <div className="text-xs font-medium text-white">
                    {snapshot.label ||
                      new Date(snapshot.timestamp).toLocaleString("sv-SE", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {snapshot.entityCounts.meals} måltider •{" "}
                    {snapshot.entityCounts.exercises} aktiviteter
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {backupService.formatBytes(snapshot.size)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
