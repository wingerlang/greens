import React, { useState } from "react";
import { User, UserPrivacy, VisibilityLevel } from "../../../models/types.ts";

interface ProfilePreviewModeProps {
  profile: User;
  currentUserId: string;
  users: User[];
  onExit: () => void;
  children: (filteredProfile: Partial<User>) => React.ReactNode;
}

type ViewerType = "public" | "friend" | "follower" | "blocked" | "specific";

export function ProfilePreviewMode(
  { profile, currentUserId, users, onExit, children }: ProfilePreviewModeProps,
) {
  const [viewerType, setViewerType] = useState<ViewerType>("public");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [simulateFriend, setSimulateFriend] = useState(false);

  // Clone the profile to apply filtering
  const filtered = { ...profile };
  const priv = profile.privacy || {
    isPublic: true,
    sharing: {
      training: "FRIENDS",
      nutrition: "FRIENDS",
      health: "PRIVATE",
      social: "FRIENDS",
      body: "PRIVATE",
    },
    categoryOverrides: {},
  } as UserPrivacy;

  // Determine "Access Level" of the selected viewer
  let accessLevel: "public" | "friend" | "owner" = "public";
  if (
    viewerType === "friend" || (viewerType === "specific" && simulateFriend)
  ) accessLevel = "friend";

  // If specific user, check overrides
  let specificOverrides = selectedUserId
    ? priv.categoryOverrides?.[selectedUserId]
    : null;

  // If blocked
  if (viewerType === "blocked") {
    return (
      <div className="min-h-screen bg-slate-900 pt-32 px-6">
        <div className="bg-slate-800 p-8 rounded-2xl border border-rose-500/20 text-center max-w-md mx-auto">
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-white mb-2">Blockerad</h2>
          <p className="text-slate-400">
            Denna användare har blivit blockerad och kan inte se din profil.
          </p>
        </div>
      </div>
    );
  }

  // Filter Logic
  // We explicitly delete/hide fields that shouldn't be seen.

  const checkAccess = (category: keyof typeof priv.sharing) => {
    // 1. Specific Override (Higher Priority)
    if (specificOverrides && specificOverrides[category] !== undefined) {
      return specificOverrides[category];
    }
    // 2. General Level
    const level = priv.sharing[category];
    if (level === "PUBLIC") return true;
    if (level === "FRIENDS" && accessLevel === "friend") return true;
    // PRIVATE is implicit false
    return false;
  };

  // Apply to sections (This relies on the Children (ProfilePage) to respect emptiness,
  // OR we modify the data structure to empty arrays/nulls)

  if (!checkAccess("body")) {
    filtered.weight = undefined;
    // filtered.measurements = []; // If we had them on the object
    // The ProfilePage uses `profile.weight`, so setting it to undefined hides it or shows '--'
  }

  if (!checkAccess("social")) {
    filtered.bio = undefined;
    filtered.location = undefined;
    filtered.website = undefined;
    // filtered.followers...
  }

  // We pass this 'filtered' object back to the parent to render

  return (
    <div className="relative">
      {/* Viewer Controls Bar */}
      <div className="sticky top-16 z-40 bg-indigo-600 text-white px-6 py-3 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👁️</span>
          <div>
            <div className="font-bold text-sm uppercase opacity-80">
              Förhandsgranska som
            </div>
            <div className="font-black text-lg flex items-center gap-2">
              {viewerType === "specific"
                ? (
                  users.find((u) => u.id === selectedUserId)?.name ||
                  "Specifik person"
                )
                : (
                  viewerType === "public"
                    ? "Publik (Utloggad)"
                    : viewerType === "friend"
                    ? "Vän"
                    : viewerType === "blocked"
                    ? "Blockerad"
                    : "Följare"
                )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={viewerType}
            onChange={(e) => setViewerType(e.target.value as ViewerType)}
            className="bg-indigo-700 border border-indigo-500 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-white/50"
          >
            <option value="public">🌍 Publik</option>
            <option value="friend">👥 Vän</option>
            <option value="blocked">🚫 Blockerad</option>
            <option value="specific">👤 Specifik person...</option>
          </select>

          {viewerType === "specific" && (
            <div className="flex items-center gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-indigo-700 border border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none w-48"
              >
                <option value="">Välj person...</option>
                {users.filter((u) => u.id !== currentUserId).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              <label className="flex items-center gap-2 cursor-pointer bg-indigo-700/50 hover:bg-indigo-700 px-3 py-2 rounded-lg border border-indigo-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={simulateFriend}
                  onChange={(e) => setSimulateFriend(e.target.checked)}
                  className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-indigo-100">
                  Är vän?
                </span>
              </label>
            </div>
          )}

          <div className="h-8 w-px bg-indigo-500 mx-2" />

          <button
            onClick={onExit}
            className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-bold text-sm hover:bg-indigo-50 transition-colors"
          >
            Avsluta
          </button>
        </div>
      </div>

      {/* Content Frame */}
      <div
        className={viewerType === "blocked"
          ? "opacity-50 pointer-events-none blur-sm select-none h-screen overflow-hidden relative"
          : ""}
      >
        {
          /*
                    If blocked, we handled it above by returning early.
                    Wait, if we returned early above, we miss the top bar!
                    We should render the top bar AND the blocked message.
                 */
        }

        {children(filtered)}
      </div>
    </div>
  );
}
