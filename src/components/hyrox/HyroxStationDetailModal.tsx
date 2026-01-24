import React, { useEffect, useState } from "react";
import { HYROX_ENCYCLOPEDIA } from "../../utils/hyroxEncyclopedia.ts";
import { HyroxStation } from "../../models/types.ts";

interface Props {
  stationId: HyroxStation;
  onClose: () => void;
  stats?: {
    pb: number;
    history: number[];
    average: number;
  };
}

// Helper for seconds -> mm:ss
const fmtSec = (s: number) => {
  if (!s) return "-";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export function HyroxStationDetailModal({ stationId, onClose, stats }: Props) {
  const data = HYROX_ENCYCLOPEDIA[stationId];
  const [activeTab, setActiveTab] = useState<
    "info" | "mechanics" | "tips" | "stats"
  >("stats");

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-amber-500/10 flex items-center justify-center text-4xl border border-amber-500/20">
            {data.icon}
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
              {data.title}
            </h2>
            <p className="text-sm text-slate-400 font-medium">
              Encyclopedia Hyrox
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-slate-500 hover:text-white transition-colors text-2xl"
          >
            &times;
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 overflow-x-auto">
          <TabBtn
            label="Min Data"
            active={activeTab === "stats"}
            onClick={() => setActiveTab("stats")}
            icon="📊"
          />
          <TabBtn
            label="Översikt"
            active={activeTab === "info"}
            onClick={() => setActiveTab("info")}
            icon="ℹ️"
          />
          <TabBtn
            label="Teknik"
            active={activeTab === "mechanics"}
            onClick={() => setActiveTab("mechanics")}
            icon="⚡"
          />
          <TabBtn
            label="Pro Tips"
            active={activeTab === "tips"}
            onClick={() => setActiveTab("tips")}
            icon="🧠"
          />
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900">
          {activeTab === "stats" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              {!stats || stats.history.length === 0
                ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">🤷‍♂️</div>
                    <h3 className="text-white font-bold mb-2">
                      Ingen data än!
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Logga detta pass i träningsdagboken för att se din
                      utveckling här.
                    </p>
                  </div>
                )
                : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                        <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">
                          Personbästa (PB)
                        </div>
                        <div className="text-3xl font-black text-white">
                          {fmtSec(stats.pb)}
                        </div>
                      </div>
                      <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">
                          Snittid
                        </div>
                        <div className="text-3xl font-black text-white">
                          {fmtSec(stats.average)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/50 p-6 rounded-xl border border-white/5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        Historik (Senaste Först)
                      </h4>
                      <div className="space-y-2">
                        {stats.history.slice(0, 10).map((time, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                          >
                            <span className="text-xs text-slate-500 font-mono">
                              #{stats.history.length - i}
                            </span>
                            <div className="flex items-center gap-3">
                              {time === stats.pb && (
                                <span className="text-[10px] bg-emerald-500 text-black px-1.5 rounded font-black">
                                  PB
                                </span>
                              )}
                              <span
                                className={`font-mono font-bold ${
                                  time === stats.pb
                                    ? "text-emerald-400"
                                    : "text-slate-300"
                                }`}
                              >
                                {fmtSec(time)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
            </div>
          )}

          {activeTab === "info" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <p className="text-lg text-slate-300 leading-relaxed font-light">
                {data.description}
              </p>

              <div className="bg-slate-950 rounded-xl p-5 border border-slate-800">
                <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-4">
                  Officiella Standarder
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <StandardItem label="Men Open" value={data.standards.men} />
                  <StandardItem
                    label="Women Open"
                    value={data.standards.women}
                  />
                  <StandardItem
                    label="Men Pro"
                    value={data.standards.pro_men}
                  />
                  <StandardItem
                    label="Women Pro"
                    value={data.standards.pro_women}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "mechanics" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <Section
                title="✅ Korrekt Utförande"
                items={data.mechanics}
                icon="✨"
                color="emerald"
              />
              <Section
                title="❌ Vanliga Misstag"
                items={data.commonMistakes}
                icon="⚠️"
                color="rose"
              />
            </div>
          )}

          {activeTab === "tips" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
                <h4 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span>🏆</span> Pro Tips
                </h4>
                <ul className="space-y-2">
                  {data.proTips.map((tip, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-300">
                      <span className="text-amber-500 font-bold">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">
                    Pacing Guide
                  </h4>
                  <p className="text-sm text-slate-200">{data.pacing}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">
                    Doubles Strategy
                  </h4>
                  <p className="text-sm text-slate-200">
                    {data.doublesStrategy}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-center">
          <button
            onClick={onClose}
            className="px-8 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full text-sm font-bold transition-colors uppercase tracking-widest"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

const TabBtn = (
  { label, active, onClick, icon }: {
    label: string;
    active: boolean;
    onClick: () => void;
    icon?: string;
  },
) => (
  <button
    onClick={onClick}
    className={`flex-1 py-4 text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 transition-all whitespace-nowrap px-4 ${
      active
        ? "border-amber-500 text-white bg-slate-800/50"
        : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
    }`}
  >
    <span className="mr-2 opacity-75">{icon}</span>
    {label}
  </button>
);

const StandardItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col">
    <span className="text-[10px] uppercase font-bold text-slate-500">
      {label}
    </span>
    <span className="text-sm font-medium text-white">{value}</span>
  </div>
);

const Section = (
  { title, items, icon, color }: {
    title: string;
    items: string[];
    icon: string;
    color: string;
  },
) => (
  <div>
    <h4
      className={`text-sm font-black text-${color}-400 uppercase tracking-widest mb-3 flex items-center gap-2`}
    >
      <span>{icon}</span> {title}
    </h4>
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex gap-3 text-sm text-slate-300 bg-slate-950/30 p-3 rounded-lg border border-slate-800"
        >
          <span className={`text-${color}-500 font-bold mt-0.5`}>•</span>
          {item}
        </li>
      ))}
    </ul>
  </div>
);
