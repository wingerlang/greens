import React from "react";
import { MuscleHierarchy, MuscleNode } from "../../../../models/muscle.ts";

interface MuscleTreeProps {
  hierarchy: MuscleHierarchy | null;
}

const TreeNode: React.FC<{ node: MuscleNode; depth: number }> = (
  { node, depth },
) => {
  return (
    <div className="ml-4">
      <div
        className={`flex items-center py-1 ${
          node.isLeaf ? "text-gray-600" : "font-medium text-gray-900"
        }`}
      >
        {/* Visual indicator of hierarchy */}
        <div
          className={`w-2 h-2 rounded-full mr-2 ${
            node.isLeaf ? "bg-indigo-400" : "bg-indigo-600"
          }`}
        />
        <span className="text-sm">{node.name}</span>
      </div>
      {node.children && (
        <div className="border-l border-gray-200 ml-1 pl-3">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const MuscleTree: React.FC<MuscleTreeProps> = ({ hierarchy }) => {
  if (!hierarchy) {
    return <div className="text-sm text-gray-500">No hierarchy data.</div>;
  }

  return (
    <div className="space-y-6">
      {hierarchy.categories.map((cat) => (
        <div key={cat.id}>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {cat.name}
          </h4>
          {cat.groups.map((group) => (
            <TreeNode key={group.id} node={group} depth={0} />
          ))}
        </div>
      ))}
    </div>
  );
};
