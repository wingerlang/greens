import React, { useMemo } from "react";
import { useData } from "../context/DataContext.tsx";
import { useAuth } from "../context/AuthContext.tsx";
import { BeastProfile } from "../features/beast/BeastProfile.tsx";
import { calculateBeastStats } from "../features/beast/utils/beastDataService.ts";

export function BeastModePage() {
  const {
    unifiedActivities,
    strengthSessions,
    currentUser,
    getLatestWeight,
    userSettings,
    isLoading,
  } = useData();
  const { user } = useAuth(); // Auth user might be simpler/faster for basic info

  const stats = useMemo(() => {
    if (!currentUser) return null;

    // Use latest weight or fallback to settings
    const weight = getLatestWeight() || userSettings.weight || 75;
    const gender = userSettings.gender || "male";

    return calculateBeastStats(
      unifiedActivities,
      strengthSessions,
      weight,
      gender,
    );
  }, [
    unifiedActivities,
    strengthSessions,
    getLatestWeight,
    userSettings,
    currentUser,
  ]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-800"></div>
          <div className="text-slate-500 font-mono text-sm">
            Loading Beast Mode...
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser || !stats) {
    return (
      <div className="p-8 text-center text-slate-400">
        User profile not found.
      </div>
    );
  }

  // Determine weight for display
  const displayWeight = getLatestWeight() || userSettings.weight || 75;

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4 md:px-8">
      <BeastProfile
        stats={stats}
        user={{
          name: currentUser.name || currentUser.username || "Athlete",
          weight: displayWeight,
          age: userSettings.birthYear
            ? new Date().getFullYear() - userSettings.birthYear
            : undefined,
          avatarUrl: currentUser.avatarUrl,
        }}
      />
    </div>
  );
}
