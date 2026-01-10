import React, { useState, useEffect } from 'react';
import { ExerciseDefinition } from '../../../../models/exercise.ts';
import { MuscleHierarchy } from '../../../../models/muscle.ts';
import { MusclePicker } from './MusclePicker.tsx';

interface ExerciseEditorModalProps {
    exercise?: ExerciseDefinition; // If undefined, we are creating
    hierarchy: MuscleHierarchy | null;
    onClose: () => void;
    onSave: (exercise: ExerciseDefinition) => Promise<void>;
}

export const ExerciseEditorModal: React.FC<ExerciseEditorModalProps> = ({ exercise, hierarchy, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<ExerciseDefinition>>({
        id: '',
        name_en: '',
        name_sv: '',
        primaryMuscles: [],
        secondaryMuscles: []
    });

    useEffect(() => {
        if (exercise) {
            setFormData(JSON.parse(JSON.stringify(exercise)));
        } else {
            // Generate a random ID for new items
            setFormData({
                id: `ex_${Date.now()}`,
                name_en: '',
                name_sv: '',
                primaryMuscles: [],
                secondaryMuscles: []
            });
        }
    }, [exercise]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Validation
        if (!formData.name_en || !formData.name_sv) {
            alert("Names are required");
            return;
        }
        await onSave(formData as ExerciseDefinition);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                        {exercise ? 'Edit Exercise' : 'Add New Exercise'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">English Name</label>
                                <input
                                    type="text"
                                    value={formData.name_en}
                                    onChange={e => setFormData({...formData, name_en: e.target.value})}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Swedish Name</label>
                                <input
                                    type="text"
                                    value={formData.name_sv}
                                    onChange={e => setFormData({...formData, name_sv: e.target.value})}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">ID (Internal)</label>
                                <input
                                    type="text"
                                    value={formData.id}
                                    readOnly={!!exercise}
                                    onChange={e => setFormData({...formData, id: e.target.value})}
                                    className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Muscle Mapping</label>
                            <MusclePicker
                                hierarchy={hierarchy}
                                selectedPrimary={formData.primaryMuscles || []}
                                selectedSecondary={formData.secondaryMuscles || []}
                                onChange={(p, s) => setFormData({...formData, primaryMuscles: p, secondaryMuscles: s})}
                            />
                        </div>
                    </div>
                </form>

                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};
