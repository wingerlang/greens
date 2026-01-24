import React from "react";
import { type PlanAnalysis } from "../../hooks/useSmartPlanner.ts";
import { type Weekday, WEEKDAYS } from "../../models/types.ts";

const DAY_ABBREV: Record<Weekday, string> = {
  monday: "Mån",
  tuesday: "Tis",
  wednesday: "Ons",
  thursday: "Tor",
  friday: "Fre",
  saturday: "Lör",
  sunday: "Sön",
};

interface SmartAnalysisPanelProps {
  analysis: PlanAnalysis;
  onOptimize?: () => void;
}

const SmartAnalysisPanel: React.FC<SmartAnalysisPanelProps> = (
  { analysis, onOptimize },
) => {
  const {
    score,
    proteinScore,
    varietyScore,
    budgetScore,
    seasonalityScore,
    tips,
    criticalIssues,
  } = analysis;

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-emerald-400";
    if (s >= 50) return "text-amber-400";
    return "text-rose-400";
  };

  const getScoreBg = (s: number) => {
    if (s >= 80) return "bg-emerald-500/10";
    if (s >= 50) return "bg-amber-500/10";
    return "bg-rose-500/10";
  };

  return (
    <div className="bg-[#1a1c1e] rounded-2xl p-6 border border-white/5 shadow-xl transition-all duration-300 hover:border-emerald-500/20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Smart Plan Analys <span className="text-emerald-500">💠</span>
          </h2>
          <p className="text-gray-400 mt-1">
            Optimerad för vegansk näring & hälsa
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`px-6 py-4 rounded-xl ${
              getScoreBg(score)
            } border border-white/5 flex flex-col items-center min-w-[120px]`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
              Greens Score
            </span>
            <span className={`text-4xl font-black ${getScoreColor(score)}`}>
              {score}
            </span>
          </div>

          <button
            onClick={onOptimize}
            className="h-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 whitespace-nowrap"
          >
            Snabba på min vecka ⚡
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <ScoreCard label="Proteinkvalitet" score={proteinScore} icon="🥜" />
        <ScoreCard label="Varierad kost" score={varietyScore} icon="🌈" />
        <ScoreCard label="Budget" score={budgetScore} icon="💰" />
        <ScoreCard label="I säsong" score={seasonalityScore} icon="❄️" />
      </div>

      <div className="mb-8">
        <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-3 px-1">
          Veckostatus
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((day, index) => {
            const da = analysis.dayAnalysis[day];
            const hasContent = da.proteinCategories.length > 0;

            // Determine if this is today
            const todayIndex = (new Date().getDay() + 6) % 7; // Convert Sun=0 to Mon=0
            const isToday = index === todayIndex;

            return (
              <div
                key={day}
                className={`p-2 rounded-xl border ${
                  isToday
                    ? "bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30"
                    : hasContent
                    ? "bg-white/5 border-white/10"
                    : "bg-transparent border-white/5 opacity-30"
                } flex flex-col items-center gap-1.5 relative`}
              >
                {/* Today indicator dot */}
                {isToday && (
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                )}
                <span
                  className={`text-[10px] font-bold uppercase ${
                    isToday ? "text-emerald-400" : "text-gray-500"
                  }`}
                >
                  {DAY_ABBREV[day]}
                </span>
                <div className="flex gap-1">
                  <StatusDot active={da.isComplete} icon="🛡️" label="Protein" />
                  <StatusDot
                    active={da.tags.includes("seasonal")}
                    icon="☀️"
                    label="Säsong"
                  />
                  <StatusDot
                    active={da.tags.includes("budget-win")}
                    icon="💰"
                    label="Budget"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {criticalIssues.length > 0 && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <h3 className="text-rose-400 font-bold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
            ⚠️ Kritiska brister
          </h3>
          <ul className="space-y-1">
            {criticalIssues.map((issue, i) => (
              <li
                key={i}
                className="text-gray-300 text-sm flex items-center gap-2"
              >
                <span className="w-1 h-1 bg-rose-500 rounded-full" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-emerald-400/80 font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
          💡 Smarta Tips
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* General Tips */}
          {tips.map((tip, i) => (
            <div
              key={`tip-${i}`}
              className="p-3 bg-white/5 border border-white/5 rounded-lg text-gray-300 text-sm leading-relaxed flex gap-3"
            >
              <span className="text-emerald-500 mt-0.5">✦</span>
              {tip}
            </div>
          ))}
          {/* Granular Day Tips */}
          {WEEKDAYS.map((day) => {
            const da = analysis.dayAnalysis[day];
            const tips = da.tips.map((tip, i) => (
              <div
                key={`day-tip-${day}-${i}`}
                className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-emerald-100/90 text-sm leading-relaxed flex gap-3"
              >
                <span className="text-emerald-500 font-bold mt-0.5">
                  {DAY_ABBREV[day]}
                </span>
                {tip}
              </div>
            ));

            const synergies = da.synergies.map((syn, i) => (
              <div
                key={`syn-${day}-${i}`}
                className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-lg text-cyan-50 text-sm leading-relaxed flex gap-3"
              >
                <span className="text-cyan-400 font-bold">{syn.icon}</span>
                <div>
                  <span className="font-bold block text-cyan-300">
                    {syn.name}
                  </span>
                  {syn.description}
                </div>
              </div>
            ));

            return [...tips, ...synergies];
          })}
        </div>
      </div>
    </div>
  );
};

interface ScoreCardProps {
  label: string;
  score: number;
  icon: string;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ label, score, icon }) => {
  const getBarColor = (s: number) => {
    if (s >= 80) return "bg-emerald-500";
    if (s >= 50) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-white font-bold">{score}%</span>
      </div>
      <div className="text-xs text-gray-400 font-medium mb-3 truncate">
        {label}
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${
            getBarColor(score)
          } transition-all duration-1000`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

const StatusDot: React.FC<{ active: boolean; icon: string; label: string }> = (
  { active, icon, label },
) => (
  <span
    title={active ? label : `Saknar ${label.toLowerCase()}`}
    className={`text-[10px] transition-all duration-500 ${
      active
        ? "opacity-100 scale-100 filter-none"
        : "opacity-20 scale-90 grayscale"
    }`}
  >
    {icon}
  </span>
);

export default SmartAnalysisPanel;
