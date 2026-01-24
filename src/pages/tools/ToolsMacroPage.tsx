import React, { useMemo, useState } from "react";
import { calculateMacros } from "../../utils/healthCalculators.ts";
import { useData } from "../../context/DataContext.tsx";
import { useSettings } from "../../context/SettingsContext.tsx";
import { NutritionWizard } from "../../components/nutrition/NutritionWizard.tsx";
import {
  Calculator,
  Check,
  Info,
  Scale,
  Sparkles,
  Utensils,
} from "lucide-react";

export function ToolsMacroPage() {
  const { weightEntries } = useData();
  const { settings, updateSettings } = useSettings();
  const [showWizard, setShowWizard] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);

  // Initial state from settings
  const [calories, setCalories] = useState(settings?.dailyCalorieGoal || 2000);
  const [dietType, setDietType] = useState("balanced");

  // Diet Presets
  const diets: Record<
    string,
    {
      label: string;
      p: number;
      c: number;
      f: number;
      desc: string;
      icon: string;
    }
  > = {
    "balanced": {
      label: "Balanserad",
      p: 30,
      c: 40,
      f: 30,
      desc: "Jämn fördelning för hälsa.",
      icon: "⚖️",
    },
    "high_protein": {
      label: "Hög Protein",
      p: 40,
      c: 35,
      f: 25,
      desc: "Muskelbyggnad & mättnad.",
      icon: "💪",
    },
    "low_carb": {
      label: "Lågkolhydrat",
      p: 40,
      c: 20,
      f: 40,
      desc: "Kolhydratkänsliga.",
      icon: "🥩",
    },
    "keto": {
      label: "Ketogen",
      p: 20,
      c: 5,
      f: 75,
      desc: "Extremt lågt kolhydrat.",
      icon: "🥑",
    },
    "athletic": {
      label: "Atleter",
      p: 25,
      c: 55,
      f: 20,
      desc: "Hög prestation.",
      icon: "🏃",
    },
  };

  const currentDiet = diets[dietType];
  const macros = calculateMacros(calories, currentDiet);

  const handleSave = () => {
    if (updateSettings) {
      updateSettings({
        dailyCalorieGoal: calories,
        dailyProteinGoal: macros.protein,
        dailyCarbsGoal: macros.carbs,
        dailyFatGoal: macros.fat,
      });
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 3000);
    }
  };

  const handleWizardSave = (profile: any) => {
    if (updateSettings) {
      updateSettings({
        dailyCalorieGoal: profile.calories,
        dailyProteinGoal: profile.protein,
        dailyCarbsGoal: profile.carbs,
        dailyFatGoal: profile.fat,
        calorieMode: profile.calorieMode,
        fixedCalorieBase: profile.fixedCalorieBase,
      });
      setCalories(profile.calories);
      setShowWizard(false);
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 3000);
    }
  };

  if (showWizard) {
    return (
      <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black text-white px-4">Hälsoguide</h1>
          <button
            onClick={() => setShowWizard(false)}
            className="text-slate-500 hover:text-white px-4"
          >
            Stäng
          </button>
        </div>
        <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <NutritionWizard
            onSave={handleWizardSave}
            onCancel={() => setShowWizard(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            <Calculator className="text-emerald-400" size={32} />
            Makrokalkylator
          </h1>
          <p className="text-slate-400 mt-2">
            Sätt dina näringsmål snabbt eller använd guiden för djupare analys.
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-emerald-400 rounded-2xl border border-emerald-500/20 font-bold transition-all group"
        >
          <Sparkles
            size={20}
            className="group-hover:rotate-12 transition-transform"
          />
          Öppna Hälsoguide
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 space-y-4">
            <label className="text-xs uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
              Din Kaloribudget
            </label>
            <div className="relative">
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-3xl font-black text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-800"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 font-bold">
                kcal
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 space-y-4">
            <label className="text-xs uppercase font-black text-slate-500 tracking-widest">
              Välj Kostupplägg
            </label>
            <div className="grid gap-2">
              {Object.entries(diets).map(([key, diet]) => (
                <button
                  key={key}
                  onClick={() => setDietType(key)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    dietType === key
                      ? "bg-emerald-500/10 border-emerald-500/50 text-white shadow-lg shadow-emerald-500/5"
                      : "bg-slate-950/50 border-white/5 text-slate-500 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{diet.icon}</span>
                    <div className="text-left">
                      <div className="font-bold text-sm tracking-tight">
                        {diet.label}
                      </div>
                      <div className="text-[10px] opacity-60 font-medium">
                        {diet.desc}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono opacity-40">
                    P{diet.p}/C{diet.c}/F{diet.f}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Card */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 sticky top-6">
            <div className="text-center mb-8">
              <div className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] mb-2">
                Daglig Fördelning
              </div>
              <div className="text-5xl font-black text-white tracking-widest">
                {calories}
              </div>
              <div className="text-slate-600 font-bold uppercase text-[10px] mt-1 tracking-widest">
                kcal per dag
              </div>
            </div>

            <div className="space-y-4">
              <MacroResultItem
                label="Protein"
                value={macros.protein}
                color="emerald"
                percentage={currentDiet.p}
              />
              <MacroResultItem
                label="Kolhydrater"
                value={macros.carbs}
                color="blue"
                percentage={currentDiet.c}
              />
              <MacroResultItem
                label="Fett"
                value={macros.fat}
                color="rose"
                percentage={currentDiet.f}
              />
            </div>

            <div className="mt-10 pt-8 border-t border-white/5">
              <button
                onClick={handleSave}
                className={`w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 ${
                  saveFeedback
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-white/5 hover:bg-white/10 text-white"
                }`}
              >
                {saveFeedback
                  ? (
                    <>
                      <Check size={20} /> SPARAT TILL PROFIL
                    </>
                  )
                  : <>Spara som mitt mål</>}
              </button>
            </div>
          </div>

          <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-3">
            <Info className="text-blue-400 shrink-0" size={20} />
            <p className="text-xs text-slate-500 leading-relaxed">
              Målen sparas direkt på din profil och kommer att styra din
              Dashboard och dina veckoplaneringar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MacroResultItem(
  { label, value, color, percentage }: {
    label: string;
    value: number;
    color: string;
    percentage: number;
  },
) {
  const colorMap: any = {
    emerald: "bg-emerald-500 text-emerald-400",
    blue: "bg-blue-500 text-blue-400",
    rose: "bg-rose-500 text-rose-400",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <span className="text-xs font-bold text-slate-400">{label}</span>
        <div className="flex items-baseline gap-1">
          <span
            className={`text-xl font-black ${colorMap[color].split(" ")[1]}`}
          >
            {value}
          </span>
          <span className="text-[10px] text-slate-600 font-bold">g</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
        <div
          className={`h-full ${
            colorMap[color].split(" ")[0]
          } transition-all duration-700`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
