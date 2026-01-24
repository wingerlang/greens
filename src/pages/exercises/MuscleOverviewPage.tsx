import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { MuscleHierarchy, MuscleNode } from "../../models/muscle.ts";
import musclesData from "../../../data/muscles.json";
import exercisesData from "../../../data/exercises.json";

// Type assertion for the imported JSON
const muscleHierarchy = musclesData as MuscleHierarchy;
const exercises = exercisesData.exercises;

export const MuscleOverviewPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const getExercisesForMuscle = (muscleId: string) => {
    const primary = exercises.filter((e) =>
      e.primaryMuscles.includes(muscleId)
    );
    const secondary = exercises.filter((e) =>
      e.secondaryMuscles.includes(muscleId)
    );
    return { primary, secondary };
  };

  const handleMuscleClick = (muscleId: string) => {
    if (selectedMuscle === muscleId) {
      setSelectedMuscle(null);
    } else {
      setSelectedMuscle(muscleId);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2">Muskelöversikt</h1>
        <p className="text-slate-400">
          Utforska övningar baserat på muskelgrupper.
        </p>
      </header>

      {/* Categories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {muscleHierarchy.categories.map((category) => (
          <button
            key={category.id}
            onClick={() => {
              setSelectedCategory(
                category.id === selectedCategory ? null : category.id,
              );
              setExpandedGroup(null);
              setSelectedMuscle(null);
            }}
            className={`p-4 rounded-xl border transition-all text-left ${
              selectedCategory === category.id
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="font-bold block">{category.name}</span>
            <span className="text-xs opacity-60">
              {category.groups.length} grupper
            </span>
          </button>
        ))}
      </div>

      {/* Muscle Groups */}
      <AnimatePresence mode="wait">
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid gap-4"
          >
            {muscleHierarchy.categories
              .find((c) => c.id === selectedCategory)
              ?.groups.map((group) => (
                <div
                  key={group.id}
                  className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedGroup(
                        expandedGroup === group.id ? null : group.id,
                      )}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <span className="font-bold text-slate-200">
                      {group.name}
                    </span>
                    <span
                      className={`text-slate-500 transition-transform duration-200 ${
                        expandedGroup === group.id ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
                  </button>

                  {/* Sub-muscles */}
                  <AnimatePresence>
                    {expandedGroup === group.id && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden bg-black/20"
                      >
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.children?.map((muscle) => (
                            <button
                              key={muscle.id}
                              onClick={() => handleMuscleClick(muscle.id)}
                              className={`p-3 rounded-lg text-sm text-left transition-all ${
                                selectedMuscle === muscle.id
                                  ? "bg-emerald-500 text-black font-bold shadow-lg shadow-emerald-500/20"
                                  : "bg-white/5 text-slate-300 hover:bg-white/10"
                              }`}
                            >
                              {muscle.name}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise List */}
      <AnimatePresence>
        {selectedMuscle && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[200] md:static md:inset-auto bg-slate-950/90 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none overflow-y-auto"
          >
            <div className="min-h-screen md:min-h-0 p-6 md:p-0">
              {/* Mobile Close Button */}
              <button
                onClick={() => setSelectedMuscle(null)}
                className="md:hidden absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white"
              >
                ✕
              </button>

              <div className="max-w-4xl mx-auto md:max-w-none space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <span className="w-2 h-8 bg-emerald-500 rounded-full" />
                  Övningar för {muscleHierarchy.categories
                    .flatMap((c) => c.groups)
                    .flatMap((g) => g.children)
                    .find((m) => m?.id === selectedMuscle)?.name}
                </h2>

                {(() => {
                  const { primary, secondary } = getExercisesForMuscle(
                    selectedMuscle,
                  );

                  if (primary.length === 0 && secondary.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-2xl border border-white/5">
                        Inga övningar hittades för denna muskel än.
                      </div>
                    );
                  }

                  return (
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Primary Focus */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                          Primärt Fokus ({primary.length})
                        </h3>
                        <div className="grid gap-2">
                          {primary.map((exercise) => (
                            <div
                              key={exercise.id}
                              className="p-3 bg-slate-900 border border-emerald-500/20 rounded-xl flex items-center justify-between group hover:border-emerald-500/50 transition-colors"
                            >
                              <span className="text-slate-200 font-medium">
                                {exercise.name_sv}
                              </span>
                              <Link
                                to={`/training/load?muscle=${selectedMuscle}&exercise=${exercise.id}`}
                                className="text-xs bg-white/5 hover:bg-emerald-500 hover:text-black px-2 py-1 rounded transition-colors"
                              >
                                Analysera ➔
                              </Link>
                            </div>
                          ))}
                          {primary.length === 0 && (
                            <p className="text-slate-600 italic">
                              Inga övningar.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Secondary Focus */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                          Sekundärt Fokus ({secondary.length})
                        </h3>
                        <div className="grid gap-2">
                          {secondary.map((exercise) => (
                            <div
                              key={exercise.id}
                              className="p-3 bg-slate-900 border border-blue-500/10 rounded-xl flex items-center justify-between group hover:border-blue-500/30 transition-colors"
                            >
                              <span className="text-slate-200 font-medium">
                                {exercise.name_sv}
                              </span>
                              <Link
                                to={`/training/load?muscle=${selectedMuscle}&exercise=${exercise.id}`}
                                className="text-xs bg-white/5 hover:bg-blue-500 hover:text-white px-2 py-1 rounded transition-colors"
                              >
                                Analysera ➔
                              </Link>
                            </div>
                          ))}
                          {secondary.length === 0 && (
                            <p className="text-slate-600 italic">
                              Inga övningar.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
