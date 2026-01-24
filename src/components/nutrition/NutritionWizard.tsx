import React, { useMemo, useState } from "react";
import {
  type ActivityLevel,
  calculateBMI,
  calculateBMR,
  calculateCalorieDeficit,
  calculateMacros,
  calculateTDEE,
} from "../../utils/healthCalculators.ts";
import { useData } from "../../context/DataContext.tsx";
import { useSettings } from "../../context/SettingsContext.tsx";
import {
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Info,
  Scale,
  Sparkles,
  Target,
  Utensils,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

interface NutritionProfile {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calorieMode: "tdee" | "fixed";
  fixedCalorieBase?: number;
  targetWeight?: number;
  weeks?: number;
  dailyDeficit?: number;
  hasWeightGoal: boolean;
}

interface NutritionWizardProps {
  onSave: (profile: NutritionProfile) => void;
  onCancel?: () => void;
  initialWeight?: number;
  initialTargetWeight?: number;
  initialWeeks?: number;
}

export function NutritionWizard(
  { onSave, onCancel, initialWeight, initialTargetWeight, initialWeeks }:
    NutritionWizardProps,
) {
  const { weightEntries } = useData();
  const { settings } = useSettings();

  // Get latest weight
  const latestWeightValue = useMemo(() => {
    if (initialWeight) return initialWeight;
    if (!weightEntries || weightEntries.length === 0) return null;
    const sorted = [...weightEntries].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted[0]?.weight || null;
  }, [weightEntries, initialWeight]);

  const calculatedAge = useMemo(() => {
    if (!settings?.birthYear) return 30;
    return new Date().getFullYear() - settings.birthYear;
  }, [settings?.birthYear]);

  // Wizard Step State
  const [step, setStep] = useState<Step>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Step 1: Body Data
  const [weight, setWeight] = useState(
    latestWeightValue || settings?.weight || 75,
  );
  const [height, setHeight] = useState(settings?.height || 175);
  const [age, setAge] = useState(calculatedAge);
  const [gender, setGender] = useState<"male" | "female">(
    settings?.gender === "male" || settings?.gender === "female"
      ? settings.gender
      : "male",
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("active");

  // Step 2: Weight Goal (optional)
  const [hasWeightGoal, setHasWeightGoal] = useState(true);
  const [targetWeight, setTargetWeight] = useState(
    initialTargetWeight || latestWeightValue || 70,
  );
  const [weeks, setWeeks] = useState(initialWeeks || 12);

  // Step 3: Calorie Configuration
  const [calorieOverride, setCalorieOverride] = useState<number | null>(null);
  const [calorieMode, setCalorieMode] = useState<"tdee" | "fixed">(
    settings?.calorieMode || "tdee",
  );

  // Step 4: Macro Split
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
      isWeightBased?: boolean;
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
    "muscle_optimized": {
      label: "Muskel-/Deffoptimera",
      p: 40,
      c: 30,
      f: 30,
      desc: "Optimera protein (~2.2g/kg).",
      icon: "🥩",
      isWeightBased: true,
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
      icon: "🥓",
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

  // Activity level options
  const activityOptions: {
    value: ActivityLevel;
    label: string;
    desc: string;
  }[] = [
    {
      value: "sedentary",
      label: "Stillasittande",
      desc: "Kontorsarbete, lite rörelse",
    },
    {
      value: "lightly_active",
      label: "Lätt aktiv",
      desc: "Lätt motion 1-3 dagar/v",
    },
    { value: "active", label: "Aktiv", desc: "Motion 3-5 dagar/v" },
    {
      value: "very_active",
      label: "Mycket aktiv",
      desc: "Hård träning 6-7 dagar/v",
    },
    {
      value: "extra_active",
      label: "Extremt aktiv",
      desc: "Fysiskt jobb + träning",
    },
  ];

  // Calculations
  const bmi = useMemo(() => calculateBMI(weight, height), [weight, height]);
  const bmr = useMemo(() => calculateBMR(weight, height, age, gender), [
    weight,
    height,
    age,
    gender,
  ]);
  const tdee = useMemo(() => calculateTDEE(bmr, activityLevel), [
    bmr,
    activityLevel,
  ]);

  const deficitResult = useMemo(() => {
    if (!hasWeightGoal) return null;
    return calculateCalorieDeficit(weight, targetWeight, weeks * 7, tdee);
  }, [weight, targetWeight, weeks, tdee, hasWeightGoal]);

  // Final calories calculation
  const targetCalories = useMemo(() => {
    if (calorieOverride !== null) return calorieOverride;
    if (hasWeightGoal && deficitResult) {
      return Math.max(1200, deficitResult.targetCalories);
    }
    return tdee;
  }, [calorieOverride, hasWeightGoal, deficitResult, tdee]);

  const currentDiet = diets[dietType];

  const macros = useMemo(() => {
    if (currentDiet.isWeightBased) {
      // Target 2.2g protein / kg
      const proteinGrams = Math.round(weight * 2.2);
      const proteinCalories = proteinGrams * 4;

      // Aim for 0.8g fat / kg (healthy minimum/standard)
      const fatGrams = Math.round(weight * 0.8);
      const fatCalories = fatGrams * 9;

      // Remaining calories to carbs
      const remainingCalories = targetCalories - proteinCalories - fatCalories;
      const carbsGrams = Math.max(0, Math.round(remainingCalories / 4));

      return {
        protein: proteinGrams,
        fat: fatGrams,
        carbs: carbsGrams,
      };
    }
    return calculateMacros(targetCalories, currentDiet);
  }, [targetCalories, currentDiet, weight]);

  const handleSave = () => {
    setIsSaving(true);
    const profile: NutritionProfile = {
      calories: targetCalories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      calorieMode: calorieMode,
      fixedCalorieBase: calorieMode === "fixed" ? targetCalories : undefined,
      targetWeight: hasWeightGoal ? targetWeight : undefined,
      weeks: hasWeightGoal ? weeks : undefined,
      dailyDeficit: deficitResult?.dailyDeficit,
      hasWeightGoal,
    };

    onSave(profile);

    // Visual feedback
    setSaveSuccess(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(false);
    }, 2000);
  };

  const getBMICategory = (bmiValue: number) => {
    if (bmiValue < 18.5) {
      return {
        label: "Undervikt",
        color: "text-blue-400",
        bg: "bg-blue-500/10",
      };
    }
    if (bmiValue < 25) {
      return {
        label: "Normalvikt",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
      };
    }
    if (bmiValue < 30) {
      return {
        label: "Övervikt",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
      };
    }
    return { label: "Fetma", color: "text-rose-400", bg: "bg-rose-500/10" };
  };

  const bmiCat = getBMICategory(bmi);
  const stepTitles = ["Data", "Mål", "Kalorier", "Makros"];
  const stepIcons = [Scale, Target, Calculator, Utensils];

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Step Indicator */}
      <div className="flex items-center justify-between bg-slate-900 border-b border-white/5 p-4 shrink-0">
        {stepTitles.map((title, i) => {
          const StepIcon = stepIcons[i];
          const stepNum = (i + 1) as Step;
          const isActive = step === stepNum;
          const isComplete = step > stepNum;
          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 flex-1 transition-all ${
                isActive ? "scale-110 opacity-100" : "opacity-50"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isComplete
                    ? "bg-emerald-500 border-emerald-500"
                    : isActive
                    ? "border-emerald-500 text-emerald-400"
                    : "border-white/20 text-slate-500"
                }`}
              >
                {isComplete
                  ? <Check size={14} className="text-white" />
                  : <StepIcon size={14} />}
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isActive ? "text-emerald-400" : "text-slate-500"
                }`}
              >
                {title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
        {/* STEP 1: Body Data */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <DataInput
                label="Vikt (kg)"
                value={weight}
                onChange={setWeight}
              />
              <DataInput
                label="Längd (cm)"
                value={height}
                onChange={setHeight}
              />
              <DataInput label="Ålder" value={age} onChange={setAge} />
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">
                  Kön
                </label>
                <div className="flex gap-1 h-12">
                  {(["male", "female"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`flex-1 rounded-xl font-bold transition-all text-sm border ${
                        gender === g
                          ? "bg-emerald-500 text-slate-950 border-emerald-500"
                          : "bg-slate-900 text-slate-400 border-white/5"
                      }`}
                    >
                      {g === "male" ? "♂ Man" : "♀ Kvinna"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold text-slate-500">
                Aktivitetsnivå
              </label>
              <div className="grid gap-2">
                {activityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setActivityLevel(opt.value)}
                    className={`flex justify-between items-center p-3 rounded-xl border transition-all text-left ${
                      activityLevel === opt.value
                        ? "bg-emerald-500/10 border-emerald-500/50 text-white"
                        : "bg-slate-900 border-white/5 hover:border-white/10 text-slate-400"
                    }`}
                  >
                    <span className="font-bold text-sm">{opt.label}</span>
                    <span className="text-[10px] opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-4 bg-slate-900 rounded-2xl border border-white/5">
              <StatBox
                label="BMI"
                value={bmi.toString()}
                subLabel={bmiCat.label}
                color={bmiCat.color}
              />
              <StatBox label="BMR" value={bmr.toString()} subLabel="Basalv." />
              <StatBox
                label="TDEE"
                value={tdee.toString()}
                subLabel="Underhåll"
                color="text-purple-400"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Goal Type & Deficit */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <button
                onClick={() => setHasWeightGoal(false)}
                className={`flex-1 p-4 rounded-2xl border transition-all text-center ${
                  !hasWeightGoal
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                    : "bg-slate-900 border-white/5 text-slate-500"
                }`}
              >
                <div className="font-black text-lg">⚖️ Behåll</div>
                <div className="text-[10px] uppercase font-bold">Vikt</div>
              </button>
              <button
                onClick={() => setHasWeightGoal(true)}
                className={`flex-1 p-4 rounded-2xl border transition-all text-center ${
                  hasWeightGoal
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                    : "bg-slate-900 border-white/5 text-slate-500"
                }`}
              >
                <div className="font-black text-lg">📉 Ändra</div>
                <div className="text-[10px] uppercase font-bold">Viktmål</div>
              </button>
            </div>

            {hasWeightGoal && (
              <div className="space-y-6 animate-in slide-in-from-bottom-2">
                <DataInput
                  label="Målvikt (kg)"
                  value={targetWeight}
                  onChange={setTargetWeight}
                />

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] uppercase font-bold text-slate-500">
                      Tidsram
                    </label>
                    <span className="text-xl font-black text-white">
                      {weeks} veckor
                    </span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="52"
                    value={weeks}
                    onChange={(e) => setWeeks(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {deficitResult && (
                  <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">
                        Daglig justering
                      </div>
                      <div
                        className={`text-2xl font-black ${
                          deficitResult.dailyDeficit > 0
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {deficitResult.dailyDeficit > 0 ? "-" : "+"}
                        {Math.abs(deficitResult.dailyDeficit)} kcal
                      </div>
                    </div>
                    <Info className="text-slate-700" size={24} />
                  </div>
                )}
              </div>
            )}

            {!hasWeightGoal && (
              <div className="p-8 text-center space-y-2">
                <div className="text-slate-500 text-sm">
                  Du siktar på att ligga på din underhållsnivå för att bibehålla
                  vikten på sikt.
                </div>
                <div className="text-3xl font-black text-white">
                  {tdee} kcal
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Calorie Mode Choice */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold text-slate-500">
                Välj hur du vill spåra
              </label>

              <button
                onClick={() => setCalorieMode("tdee")}
                className={`w-full p-4 rounded-2xl border transition-all text-left flex gap-4 ${
                  calorieMode === "tdee"
                    ? "bg-purple-500/10 border-purple-500"
                    : "bg-slate-900 border-white/5"
                }`}
              >
                <div className="shrink-0 w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <Target size={24} />
                </div>
                <div>
                  <div
                    className={`font-bold ${
                      calorieMode === "tdee" ? "text-white" : "text-slate-400"
                    }`}
                  >
                    TDEE-baserat (Rekommenderas)
                  </div>
                  <div className="text-xs text-slate-500">
                    Målet anpassas efter din beräknade aktivitetsnivå
                    automatiskt.
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCalorieMode("fixed")}
                className={`w-full p-4 rounded-2xl border transition-all text-left flex gap-4 ${
                  calorieMode === "fixed"
                    ? "bg-blue-500/10 border-blue-500"
                    : "bg-slate-900 border-white/5"
                }`}
              >
                <div className="shrink-0 w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Utensils size={24} />
                </div>
                <div>
                  <div
                    className={`font-bold ${
                      calorieMode === "fixed" ? "text-white" : "text-slate-400"
                    }`}
                  >
                    Fast bas + Ät det du tränar
                  </div>
                  <div className="text-xs text-slate-500">
                    Ha ett fast basmål (t.ex. 1500 kcal). När du tränar ökar
                    målet automatiskt.
                  </div>
                </div>
              </button>
            </div>

            <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-white/10 text-center space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-500">
                Ditt basala kalorimål
              </div>
              <div className="text-5xl font-black text-white">
                {targetCalories}
              </div>
              <div className="text-xs text-slate-400">kcal / dag</div>

              <div className="pt-4 flex justify-center gap-2">
                <input
                  type="number"
                  value={calorieOverride ?? targetCalories}
                  onChange={(e) =>
                    setCalorieOverride(Number(e.target.value) || null)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-center font-bold text-emerald-400 focus:outline-none"
                />
                {calorieOverride !== null && (
                  <button
                    onClick={() => setCalorieOverride(null)}
                    className="text-[10px] text-slate-500 hover:text-white underline"
                  >
                    återställ
                  </button>
                )}
              </div>
            </div>

            {calorieMode === "fixed" && (
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-blue-400 text-xs flex gap-3">
                <Flame size={20} className="shrink-0" />
                <p>
                  Exempel: Om ditt mål är 1500 och du springer en runda som
                  bränner 400 kcal, kommer ditt dagliga mål bli 1900 kcal.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Macros */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-slate-500">
                Kostupplägg
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(diets).map(([key, diet]) => (
                  <button
                    key={key}
                    onClick={() => setDietType(key)}
                    className={`p-3 rounded-xl border transition-all text-left flex items-center gap-2 ${
                      dietType === key
                        ? "bg-emerald-500/10 border-emerald-500/50 text-white"
                        : "bg-slate-900 border-white/5 text-slate-500"
                    }`}
                  >
                    <span className="text-lg">{diet.icon}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">{diet.label}</span>
                      <span className="text-[9px] opacity-70">
                        P{diet.p} C{diet.c} F{diet.f}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <SmallMacroBox
                label="Protein"
                value={macros.protein}
                unit="g"
                color="text-emerald-400"
                bg="bg-emerald-500/10"
              />
              <SmallMacroBox
                label="Kolisar"
                value={macros.carbs}
                unit="g"
                color="text-blue-400"
                bg="bg-blue-500/10"
              />
              <SmallMacroBox
                label="Fett"
                value={macros.fat}
                unit="g"
                color="text-rose-400"
                bg="bg-rose-500/10"
              />
            </div>

            <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">Sammanfattning</span>
                <span className="text-slate-500">{targetCalories} kcal</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${currentDiet.p}%` }}
                />
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${currentDiet.c}%` }}
                />
                <div
                  className="h-full bg-rose-500"
                  style={{ width: `${currentDiet.f}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-bold text-slate-500">
                <span>{currentDiet.p}% P</span>
                <span>{currentDiet.c}% C</span>
                <span>{currentDiet.f}% F</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                saveSuccess
                  ? "bg-emerald-500 text-slate-950 translate-y-0"
                  : isSaving
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {saveSuccess
                ? (
                  <>
                    <Check size={24} /> SPARAT!
                  </>
                )
                : <>💾 SPARA SOM MITT MÅL</>}
              {isSaving && !saveSuccess && (
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Navigation Bar */}
      <div className="p-4 bg-slate-900 border-t border-white/5 flex gap-2 shrink-0">
        {step > 1
          ? (
            <button
              onClick={() => setStep((step - 1) as Step)}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <ChevronLeft size={18} /> Bakåt
            </button>
          )
          : onCancel
          ? (
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 text-white font-bold text-sm"
            >
              Avbryt
            </button>
          )
          : null}

        {step < 4 && (
          <button
            onClick={() => setStep((step + 1) as Step)}
            className="flex-[2] py-3 px-4 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2"
          >
            Nästa <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function DataInput(
  { label, value, onChange }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  },
) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase font-bold text-slate-500">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-12 bg-slate-900 border border-white/10 rounded-xl px-4 text-white text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
      />
    </div>
  );
}

function StatBox(
  { label, value, subLabel, color = "text-white" }: {
    label: string;
    value: string;
    subLabel: string;
    color?: string;
  },
) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-slate-500 font-bold uppercase">
        {label}
      </div>
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[8px] text-slate-600 font-bold uppercase">
        {subLabel}
      </div>
    </div>
  );
}

function SmallMacroBox(
  { label, value, unit, color, bg }: {
    label: string;
    value: number;
    unit: string;
    color: string;
    bg: string;
  },
) {
  return (
    <div className={`p-3 rounded-2xl ${bg} text-center space-y-0.5`}>
      <div className={`text-xl font-black ${color}`}>{value}{unit}</div>
      <div className="text-[9px] text-slate-500 font-bold uppercase">
        {label}
      </div>
    </div>
  );
}
