// src/models/muscle.ts

export type MuscleCategory = "upper" | "core" | "lower" | "cardio" | "other";

export interface MuscleNode {
  id: string; // e.g., "biceps", "quads", "upper_chest"
  name: string; // Display name (Swedish default, or localized)
  children?: MuscleNode[]; // Sub-muscles (e.g., Arms -> Biceps)
  isLeaf?: boolean; // If true, this is a selectable muscle
}

export interface MuscleHierarchy {
  version: number;
  categories: {
    id: MuscleCategory;
    name: string;
    groups: MuscleNode[];
  }[];
}
