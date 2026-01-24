import { useEffect, useState } from "react";
import { MuscleHierarchy } from "../../models/muscle.ts";
import { ExerciseDefinition } from "../../models/exercise.ts";
import { MuscleTree } from "../../components/admin/exercises/MuscleTree.tsx";
import { ExerciseList } from "../../components/admin/exercises/ExerciseList.tsx";
import { ExerciseEditorModal } from "../../components/admin/exercises/ExerciseEditorModal.tsx";

export default function ExerciseDatabasePage() {
  const [hierarchy, setHierarchy] = useState<MuscleHierarchy | null>(null);
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([]);
  const [unmappedExercises, setUnmappedExercises] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"exercises" | "unmapped">(
    "exercises",
  );
  const [search, setSearch] = useState("");
  const [editingExercise, setEditingExercise] = useState<
    ExerciseDefinition | undefined
  >(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State for mapping modal
  const [mappingTarget, setMappingTarget] = useState<string | null>(null); // The unmapped name
  const [selectedMapId, setSelectedMapId] = useState<string>(""); // The target exercise ID

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [musclesRes, exercisesRes] = await Promise.all([
        fetch("/api/muscles"),
        fetch("/api/exercises"),
      ]);

      const musclesData = await musclesRes.json();
      const exercisesData = await exercisesRes.json();

      setHierarchy(musclesData);
      setExercises(exercisesData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnmapped = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exercises?unmapped=true");
      const data = await res.json();
      setUnmappedExercises(data.unmapped || []);
    } catch (error) {
      console.error("Failed to fetch unmapped", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "unmapped") {
      fetchUnmapped();
    }
  }, [activeTab]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/exercises?id=${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };

  const handleSave = async (exercise: ExerciseDefinition): Promise<boolean> => {
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exercise),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchData();
      setIsModalOpen(false);
      return true;
    } catch (error) {
      console.error("Failed to save", error);
      return false;
    }
  };

  const handleMapExercise = async () => {
    if (!mappingTarget || !selectedMapId) return;
    const targetExercise = exercises.find((e) => e.id === selectedMapId);
    if (!targetExercise) return;

    // Add alias
    const updatedExercise = {
      ...targetExercise,
      aliases: [...(targetExercise.aliases || []), mappingTarget],
    };

    await handleSave(updatedExercise);

    // Remove from list locally
    setUnmappedExercises((prev) => prev.filter((n) => n !== mappingTarget));
    setMappingTarget(null);
    setSelectedMapId("");
  };

  const openCreateModal = () => {
    setEditingExercise(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (exercise: ExerciseDefinition) => {
    setEditingExercise(exercise);
    setIsModalOpen(true);
  };

  const filteredExercises = exercises.filter((e) =>
    e.name_en.toLowerCase().includes(search.toLowerCase()) ||
    e.name_sv.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-3xl font-black text-white">
            Övningsdatabas
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Hantera övningar, muskelgrupper och alias.
          </p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button
            onClick={() => setActiveTab("exercises")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === "exercises"
                ? "bg-emerald-500 text-slate-900"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Övningar
          </button>
          <button
            onClick={() => setActiveTab("unmapped")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === "unmapped"
                ? "bg-amber-500 text-slate-900"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Omappade ({unmappedExercises.length})
          </button>
        </div>
      </div>

      {activeTab === "exercises"
        ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Muscle Hierarchy */}
            <div className="lg:col-span-1 bg-slate-900/50 border border-white/5 rounded-2xl p-6 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-white mb-4">
                Muscle Hierarchy
              </h3>
              <MuscleTree hierarchy={hierarchy} />
            </div>

            {/* Right Column: Exercise List */}
            <div className="lg:col-span-2 bg-slate-900/50 border border-white/5 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Övningar</h3>
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center px-4 py-2 border border-emerald-500/20 text-sm font-bold rounded-xl text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
                >
                  + Lägg till övning
                </button>
              </div>
              <div className="relative mb-6">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Sök övningar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
              <div className="bg-slate-900 rounded-xl overflow-hidden border border-white/5">
                <ExerciseList
                  exercises={filteredExercises}
                  loading={loading}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                />
              </div>
            </div>
          </div>
        )
        : (
          /* Unmapped View */
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              Övningar som saknar mappning
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Dessa namn har dykt upp i träningspass men matchar ingen känd
              övning (eller alias) i databasen.
            </p>

            {loading
              ? (
                <div className="text-center py-12 text-slate-500">
                  Laddar...
                </div>
              )
              : unmappedExercises.length === 0
              ? (
                <div className="text-center py-12 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
                  <p className="font-bold">Allt är mappat!</p>
                  <p className="text-sm opacity-80">
                    Inga okända övningar hittades.
                  </p>
                </div>
              )
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unmappedExercises.map((name) => (
                    <div
                      key={name}
                      className="bg-slate-950 border border-white/10 p-4 rounded-xl flex flex-col justify-between group hover:border-amber-500/50 transition-all"
                    >
                      <h4 className="font-bold text-white mb-2">{name}</h4>
                      <button
                        onClick={() => setMappingTarget(name)}
                        className="text-xs bg-slate-800 hover:bg-amber-500 hover:text-slate-900 text-slate-400 py-2 px-3 rounded-lg font-bold uppercase transition-all"
                      >
                        Mappa till befintlig
                      </button>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

      {isModalOpen && (
        <ExerciseEditorModal
          exercise={editingExercise}
          hierarchy={hierarchy}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* Mapping Modal */}
      {mappingTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setMappingTarget(null)}
          />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              Mappa "{mappingTarget}"
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              Välj vilken övning i databasen som motsvarar{" "}
              <strong>{mappingTarget}</strong>. Detta lägger till namnet som ett
              alias.
            </p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Välj Övning
              </label>
              <select
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 appearance-none"
                value={selectedMapId}
                onChange={(e) => setSelectedMapId(e.target.value)}
              >
                <option value="">-- Välj övning --</option>
                {exercises.sort((a, b) => a.name_sv.localeCompare(b.name_sv))
                  .map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name_sv} / {ex.name_en}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMappingTarget(null)}
                className="px-4 py-2 rounded-xl font-bold text-slate-400 hover:text-white"
              >
                Avbryt
              </button>
              <button
                onClick={handleMapExercise}
                disabled={!selectedMapId}
                className="px-4 py-2 rounded-xl font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Spara Mappning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
