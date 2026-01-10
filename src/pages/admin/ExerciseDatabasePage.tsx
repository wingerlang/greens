import { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { MuscleHierarchy } from '../../models/muscle.ts';
import { ExerciseDefinition } from '../../models/exercise.ts';
import { MuscleTree } from '../../components/admin/exercises/MuscleTree.tsx';
import { ExerciseList } from '../../components/admin/exercises/ExerciseList.tsx';
import { ExerciseEditorModal } from '../../components/admin/exercises/ExerciseEditorModal.tsx';

export default function ExerciseDatabasePage() {
    const [hierarchy, setHierarchy] = useState<MuscleHierarchy | null>(null);
    const [exercises, setExercises] = useState<ExerciseDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingExercise, setEditingExercise] = useState<ExerciseDefinition | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [musclesRes, exercisesRes] = await Promise.all([
                fetch('/api/muscles'),
                fetch('/api/exercises')
            ]);

            const musclesData = await musclesRes.json();
            const exercisesData = await exercisesRes.json();

            setHierarchy(musclesData);
            setExercises(exercisesData);
        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch(`/api/exercises?id=${id}`, { method: 'DELETE' });
            fetchData();
        } catch (error) {
            console.error("Failed to delete", error);
        }
    };

    const handleSave = async (exercise: ExerciseDefinition) => {
        try {
            await fetch('/api/exercises', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(exercise)
            });
            await fetchData();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save", error);
            alert("Failed to save exercise");
        }
    };

    const openCreateModal = () => {
        setEditingExercise(undefined);
        setIsModalOpen(true);
    };

    const openEditModal = (exercise: ExerciseDefinition) => {
        setEditingExercise(exercise);
        setIsModalOpen(true);
    };

    const filteredExercises = exercises.filter(e =>
        e.name_en.toLowerCase().includes(search.toLowerCase()) ||
        e.name_sv.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="md:flex md:items-center md:justify-between mb-8">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">
                            Exercise Database
                        </h2>
                        <p className="mt-1 text-sm text-gray-400">
                            Manage exercises and muscle mappings.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Muscle Hierarchy */}
                    <div className="lg:col-span-1 bg-slate-800 shadow rounded-lg p-6 max-h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-medium text-white mb-4">Muscle Hierarchy</h3>
                        <MuscleTree hierarchy={hierarchy} />
                    </div>

                    {/* Right Column: Exercise List */}
                    <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-gray-900">Exercises</h3>
                            <button
                                onClick={openCreateModal}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Add Exercise
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Search exercises..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mb-4 p-2 border"
                        />
                        <ExerciseList
                            exercises={filteredExercises}
                            loading={loading}
                            onEdit={openEditModal}
                            onDelete={handleDelete}
                        />
                    </div>
                </div>

                {isModalOpen && (
                    <ExerciseEditorModal
                        exercise={editingExercise}
                        hierarchy={hierarchy}
                        onClose={() => setIsModalOpen(false)}
                        onSave={handleSave}
                    />
                )}
            </div>
        </Layout>
    );
}
