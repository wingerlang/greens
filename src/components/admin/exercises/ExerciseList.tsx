import React from "react";
import { ExerciseDefinition } from "../../../../models/exercise.ts";

interface ExerciseListProps {
  exercises: ExerciseDefinition[];
  loading: boolean;
  onEdit: (exercise: ExerciseDefinition) => void;
  onDelete: (id: string) => void;
}

export const ExerciseList: React.FC<ExerciseListProps> = (
  { exercises, loading, onEdit, onDelete },
) => {
  if (loading) return <div className="text-center py-4">Loading...</div>;

  if (exercises.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">No exercises found.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name (EN)
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Namn (SV)
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Primary Muscles
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {exercises.map((exercise) => (
            <tr key={exercise.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {exercise.name_en}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {exercise.name_sv}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {exercise.primaryMuscles.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-1"
                  >
                    {m}
                  </span>
                ))}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() =>
                    onEdit(exercise)}
                  className="text-indigo-600 hover:text-indigo-900 mr-4"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm("Are you sure you want to delete this exercise?")
                    ) {
                      onDelete(exercise.id);
                    }
                  }}
                  className="text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
