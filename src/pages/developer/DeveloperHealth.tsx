import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useDeveloper } from "./DeveloperContext.tsx";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  FileWarning,
  ShieldCheck,
  Trash2,
} from "lucide-react";

interface CodeIssue {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  file: string;
  relatedFile?: string;
}

interface DuplicateFunction {
  nameA: string;
  nameB: string;
  fileA: string;
  fileB: string;
  similarity: number;
}

export function DeveloperHealth() {
  const { token } = useAuth();
  const { excludedFolders, refreshTrigger } = useDeveloper();
  const [issues, setIssues] = useState<CodeIssue[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateFunction[]>([]);
  const [unusedFiles, setUnusedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const query = new URLSearchParams({ excluded: excludedFolders.join(",") })
    .toString();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/developer/analysis?${query}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/developer/functions?${query}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/developer/unused?${query}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([issuesData, duplicatesData, unusedData]) => {
        setIssues(issuesData.issues || []);
        setDuplicates(duplicatesData.duplicates || []);
        setUnusedFiles(unusedData.unused || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, refreshTrigger, query]);

  if (loading) {
    return (
      <div className="p-8 text-slate-400 animate-pulse">
        Running health check...
      </div>
    );
  }

  const largeFiles = issues.filter((i) => i.type === "large_file");
  const otherIssues = issues.filter((i) => i.type !== "large_file");

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <header>
        <h1 className="text-2xl font-bold text-white mb-2">Codebase Health</h1>
        <p className="text-slate-400">
          Automated analysis of technical debt, duplication, and unused code.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HealthCard
          title="Code Issues"
          value={issues.length}
          icon={<AlertTriangle size={20} className="text-amber-500" />}
          color="text-amber-500"
        />
        <HealthCard
          title="Duplications"
          value={duplicates.length}
          icon={<Copy size={20} className="text-blue-500" />}
          color="text-blue-500"
        />
        <HealthCard
          title="Unused Files"
          value={unusedFiles.length}
          icon={<Trash2 size={20} className="text-red-500" />}
          color="text-red-500"
        />
      </div>

      {/* Large Files Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileWarning size={18} className="text-amber-400" />
            Large Files ({largeFiles.length})
          </h2>
          <span className="text-xs text-slate-500">
            Files exceeding 300 lines
          </span>
        </div>
        <div className="divide-y divide-slate-700/50">
          {largeFiles.length === 0
            ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <ShieldCheck size={32} className="text-emerald-500/50" />
                <p>No large files detected. Great job!</p>
              </div>
            )
            : (
              largeFiles.slice(0, 10).map((issue, i) => (
                <div
                  key={i}
                  className="p-4 hover:bg-slate-700/30 transition-colors flex items-center justify-between"
                >
                  <span className="font-mono text-sm text-slate-300">
                    {issue.file}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full border ${
                      issue.severity === "high"
                        ? "bg-red-500/10 border-red-500/50 text-red-400"
                        : "bg-amber-500/10 border-amber-500/50 text-amber-400"
                    }`}
                  >
                    {issue.message.replace("Large file detected: ", "")}
                  </span>
                </div>
              ))
            )}
          {largeFiles.length > 10 && (
            <div className="p-3 text-center text-xs text-slate-500 bg-slate-800/50">
              + {largeFiles.length - 10} more files
            </div>
          )}
        </div>
      </div>

      {/* Duplications Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Copy size={18} className="text-blue-400" />
            Code Duplication ({duplicates.length})
          </h2>
          <span className="text-xs text-slate-500">
            Similar functions detected
          </span>
        </div>
        <div className="divide-y divide-slate-700/50">
          {duplicates.length === 0
            ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <ShieldCheck size={32} className="text-emerald-500/50" />
                <p>No significant duplications found.</p>
              </div>
            )
            : (
              duplicates.map((dup, i) => (
                <div
                  key={i}
                  className="p-4 hover:bg-slate-700/30 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-white font-medium">
                      <span>{dup.nameA}</span>
                      {dup.nameA !== dup.nameB && (
                        <span className="text-slate-500">vs {dup.nameB}</span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-blue-400">
                      {(dup.similarity * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                    <span className="truncate flex-1" title={dup.fileA}>
                      {dup.fileA.split("/").slice(-2).join("/")}
                    </span>
                    <ArrowRight size={12} className="text-slate-600" />
                    <span
                      className="truncate flex-1 text-right"
                      title={dup.fileB}
                    >
                      {dup.fileB.split("/").slice(-2).join("/")}
                    </span>
                  </div>
                </div>
              ))
            )}
        </div>
      </div>

      {/* Unused Files Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Trash2 size={18} className="text-red-400" />
            Potentially Unused Files ({unusedFiles.length})
          </h2>
          <span className="text-xs text-slate-500">
            Not imported by other files
          </span>
        </div>
        <div className="p-0">
          {unusedFiles.length === 0
            ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <ShieldCheck size={32} className="text-emerald-500/50" />
                <p>No unused files detected.</p>
              </div>
            )
            : (
              <div className="max-h-[300px] overflow-auto">
                {unusedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="p-3 px-4 hover:bg-slate-700/30 border-b border-slate-700/50 flex items-center justify-between group"
                  >
                    <span className="text-sm font-mono text-slate-300">
                      {file}
                    </span>
                    <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      Check manually before deleting
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function HealthCard(
  { title, value, icon, color }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
  },
) {
  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
      <div>
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
          {title}
        </h3>
        <p className={`text-3xl font-mono ${color}`}>{value}</p>
      </div>
      <div
        className={`p-3 rounded-full bg-opacity-10 ${
          color.replace("text-", "bg-")
        }`}
      >
        {icon}
      </div>
    </div>
  );
}
