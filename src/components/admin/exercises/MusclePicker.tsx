import React, { useState } from 'react';
import { MuscleHierarchy, MuscleNode } from '../../../../models/muscle.ts';

interface MusclePickerProps {
    hierarchy: MuscleHierarchy | null;
    selectedPrimary: string[];
    selectedSecondary: string[];
    onChange: (primary: string[], secondary: string[]) => void;
}

const MuscleNodePicker: React.FC<{
    node: MuscleNode;
    selectedPrimary: string[];
    selectedSecondary: string[];
    onToggle: (id: string, type: 'primary' | 'secondary' | 'none') => void;
}> = ({ node, selectedPrimary, selectedSecondary, onToggle }) => {
    const isPrimary = selectedPrimary.includes(node.id);
    const isSecondary = selectedSecondary.includes(node.id);

    const getStatus = () => {
        if (isPrimary) return 'primary';
        if (isSecondary) return 'secondary';
        return 'none';
    };

    const handleClick = () => {
        if (!node.isLeaf) return; // Only allow selecting leaves for now

        const current = getStatus();
        let next: 'primary' | 'secondary' | 'none' = 'none';

        // Cycle: None -> Primary -> Secondary -> None
        if (current === 'none') next = 'primary';
        else if (current === 'primary') next = 'secondary';
        else next = 'none';

        onToggle(node.id, next);
    };

    return (
        <div className="ml-4 my-1">
            <div
                className={`flex items-center cursor-pointer select-none ${!node.isLeaf ? 'opacity-80' : ''}`}
                onClick={handleClick}
            >
                <div
                    className={`w-4 h-4 rounded-sm border mr-2 flex items-center justify-center transition-colors ${
                        isPrimary ? 'bg-green-500 border-green-600' :
                        isSecondary ? 'bg-yellow-400 border-yellow-500' :
                        'bg-white border-gray-300'
                    }`}
                >
                    {isPrimary && <span className="text-[10px] text-white font-bold">P</span>}
                    {isSecondary && <span className="text-[10px] text-white font-bold">S</span>}
                </div>
                <span className={`text-sm ${isPrimary ? 'font-bold text-green-700' : isSecondary ? 'font-bold text-yellow-600' : 'text-gray-700'}`}>
                    {node.name}
                </span>
            </div>
            {node.children && (
                <div className="ml-2 border-l border-gray-200 pl-2">
                    {node.children.map(child => (
                        <MuscleNodePicker
                            key={child.id}
                            node={child}
                            selectedPrimary={selectedPrimary}
                            selectedSecondary={selectedSecondary}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const MusclePicker: React.FC<MusclePickerProps> = ({ hierarchy, selectedPrimary, selectedSecondary, onChange }) => {
    if (!hierarchy) return <div>Loading muscles...</div>;

    const handleToggle = (id: string, type: 'primary' | 'secondary' | 'none') => {
        let newPrimary = [...selectedPrimary];
        let newSecondary = [...selectedSecondary];

        // Remove from both first
        newPrimary = newPrimary.filter(m => m !== id);
        newSecondary = newSecondary.filter(m => m !== id);

        if (type === 'primary') newPrimary.push(id);
        if (type === 'secondary') newSecondary.push(id);

        onChange(newPrimary, newSecondary);
    };

    return (
        <div className="border rounded-md p-4 max-h-96 overflow-y-auto bg-gray-50">
            <div className="text-xs text-gray-500 mb-2 sticky top-0 bg-gray-50 pb-2 border-b z-10">
                Click to cycle: <span className="text-green-600 font-bold">Primary</span> → <span className="text-yellow-600 font-bold">Secondary</span> → None
            </div>
            {hierarchy.categories.map(cat => (
                <div key={cat.id} className="mb-4">
                    <h5 className="font-bold text-xs uppercase text-gray-400 mb-1">{cat.name}</h5>
                    {cat.groups.map(group => (
                        <MuscleNodePicker
                            key={group.id}
                            node={group}
                            selectedPrimary={selectedPrimary}
                            selectedSecondary={selectedSecondary}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
};
