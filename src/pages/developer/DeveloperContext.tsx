import React, { createContext, useContext, useEffect, useState } from "react";

interface DeveloperContextType {
  excludedFolders: string[];
  toggleExclusion: (path: string) => void;
  isExcluded: (path: string) => boolean;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const DeveloperContext = createContext<DeveloperContextType | null>(null);

export function DeveloperProvider({ children }: { children: React.ReactNode }) {
  const [excludedFolders, setExcludedFolders] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("dev_excluded_folders");
    if (saved) {
      setExcludedFolders(JSON.parse(saved));
    } else {
      // Defaults
      setExcludedFolders(["src/data", "data"]);
    }
  }, []);

  const toggleExclusion = (path: string) => {
    setExcludedFolders((prev) => {
      const next = prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path];
      localStorage.setItem("dev_excluded_folders", JSON.stringify(next));
      return next;
    });
  };

  const isExcluded = (path: string) => {
    return excludedFolders.some((ex) =>
      path === ex || path.startsWith(ex + "/") || path.includes("/" + ex + "/")
    );
  };

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  return (
    <DeveloperContext.Provider
      value={{
        excludedFolders,
        toggleExclusion,
        isExcluded,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </DeveloperContext.Provider>
  );
}

export function useDeveloper() {
  const ctx = useContext(DeveloperContext);
  if (!ctx) {
    throw new Error("useDeveloper must be used within DeveloperProvider");
  }
  return ctx;
}
