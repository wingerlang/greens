import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useDeveloper } from "./DeveloperContext.tsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  AlertOctagon,
  Box,
  Camera,
  ChevronDown,
  ChevronRight,
  Filter,
  GitCommit,
  Hash,
  Layers,
  RefreshCw,
} from "lucide-react";

interface GitStats {
  topChurnFiles: { file: string; changes: number }[];
  newFilesHistory: { date: string; count: number }[];
}

interface ComplexityStats {
  mostComplexFiles: { file: string; maxDepth: number }[];
  averageDepth: number;
}

interface ProjectStats {
  totalFiles: number;
  totalLines: number;
  filesByExtension: Record<string, number>;
  linesByExtension: Record<string, number>;
  gitStats?: GitStats;
  complexityStats?: ComplexityStats;
  dependencyCount?: number;
  excludedRules?: string[];
}

interface DeveloperSnapshot {
  timestamp: number;
  stats: ProjectStats;
}

export function DeveloperDeepAnalysis() {
  const { token } = useAuth();
  const { excludedFolders, toggleExclusion, refreshTrigger } = useDeveloper();
  const [history, setHistory] = useState<DeveloperSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);

  // Snapshot Exclusion Controls
  const [customExcludes, setCustomExcludes] = useState<string>("");
  const [showControls, setShowControls] = useState(false);

  // View State
  const [selectedSnapshot, setSelectedSnapshot] = useState<
    DeveloperSnapshot | null
  >(null);

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/developer/history", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      const hist = data.history || [];
      setHistory(hist);
      if (hist.length > 0 && !selectedSnapshot) {
        setSelectedSnapshot(hist[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [token, refreshTrigger]);

  useEffect(() => {
    // Init custom excludes from context
    setCustomExcludes(excludedFolders.join(", "));
  }, [excludedFolders]);

  const takeSnapshot = async () => {
    if (snapshotting) return;
    setSnapshotting(true);
    try {
      const excludesList = customExcludes.split(",").map((s) => s.trim())
        .filter((s) => s);

      await fetch(`/api/developer/snapshot`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ excluded: excludesList }),
      });
      await loadHistory();
    } catch (e) {
      console.error(e);
    } finally {
      setSnapshotting(false);
    }
  };

  const currentStats = selectedSnapshot?.stats;

  // Chart Data Preparation
  const evolutionData = useMemo(() => {
    return history.map((h) => ({
      date: new Date(h.timestamp).toLocaleDateString(),
      timestamp: h.timestamp,
      files: h.stats.totalFiles,
      lines: h.stats.totalLines,
      dependencies: h.stats.dependencyCount || 0,
      complexity: h.stats.complexityStats?.averageDepth || 0,
    })).reverse(); // Chronological
  }, [history]);

  const hotspotData = useMemo(() => {
    if (!currentStats?.gitStats?.topChurnFiles) return [];
    // Need to correlate size (lines) with churn.
    // We don't have per-file lines in stats.topChurnFiles, only global aggregate or file traversal.
    // But complexityStats has most complex files.
    // Let's just plot Churn vs Change Count (Wait, Churn IS Change Count).
    // Maybe we just plot Churn.
    return currentStats.gitStats.topChurnFiles.map((f) => ({
      name: f.file.split("/").pop(),
      fullPath: f.file,
      changes: f.changes,
      // Mock size if missing, or use complexity if available in match
      // Ideally backend would return size with churn stats.
      // For now, we visualize churn directly.
    }));
  }, [currentStats]);

  const complexityData = useMemo(() => {
    if (!currentStats?.complexityStats?.mostComplexFiles) return [];
    return currentStats.complexityStats.mostComplexFiles.map((f) => ({
      name: f.file.split("/").pop(),
      path: f.file,
      depth: f.maxDepth,
    }));
  }, [currentStats]);

  const newFilesData = useMemo(() => {
    if (!currentStats?.gitStats?.newFilesHistory) return [];
    return currentStats.gitStats.newFilesHistory.slice(-30); // Last 30 entries
  }, [currentStats]);

  if (loading) {
    return (
      <div className="p-8 text-slate-400 animate-pulse">
        Loading Deep Analysis...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Layers size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Dashboard 3.0</h1>
              <p className="text-xs text-slate-400">
                Deep System Analysis & Evolution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative group">
              <button
                onClick={() => setShowControls(!showControls)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 flex items-center gap-2 text-sm transition-colors"
              >
                <Filter size={16} />
                {showControls ? "Hide Controls" : "Snapshot Controls"}
                {showControls
                  ? <ChevronDown size={14} />
                  : <ChevronRight size={14} />}
              </button>
            </div>
            <button
              onClick={takeSnapshot}
              disabled={snapshotting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
            >
              {snapshotting
                ? <RefreshCw size={16} className="animate-spin" />
                : <Camera size={16} />}
              {snapshotting ? "Analyzing..." : "Capture Snapshot"}
            </button>
          </div>
        </div>

        {showControls && (
          <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Exclusion Rules (Folders/Files to ignore)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customExcludes}
                onChange={(e) => setCustomExcludes(e.target.value)}
                placeholder="node_modules, .git, dist, ..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Comma separated. These rules will be applied to the new snapshot
              and stored in history.
            </p>
          </div>
        )}
      </div>

      {/* History Selector */}
      {history.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {history.map((h) => (
            <button
              key={h.timestamp}
              onClick={() => setSelectedSnapshot(h)}
              className={`flex flex-col items-start min-w-[140px] p-3 rounded-lg border text-xs transition-all ${
                selectedSnapshot?.timestamp === h.timestamp
                  ? "bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/20"
                  : "bg-slate-800 border-slate-700 hover:border-slate-600"
              }`}
            >
              <span
                className={`font-semibold ${
                  selectedSnapshot?.timestamp === h.timestamp
                    ? "text-indigo-400"
                    : "text-slate-300"
                }`}
              >
                {new Date(h.timestamp).toLocaleDateString()}
              </span>
              <span className="text-slate-500 mt-1">
                {new Date(h.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div className="mt-2 flex gap-2">
                <span className="text-slate-400">
                  {h.stats.totalFiles} files
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Column 1: Metrics & Evolution */}
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              title="Avg Complexity"
              value={currentStats?.complexityStats?.averageDepth.toFixed(1) ||
                "N/A"}
              icon={<AlertOctagon size={16} className="text-amber-400" />}
              trend={evolutionData.length > 1
                ? (evolutionData[evolutionData.length - 1].complexity -
                  evolutionData[evolutionData.length - 2].complexity).toFixed(1)
                : undefined}
            />
            <MetricCard
              title="Dependencies"
              value={currentStats?.dependencyCount || 0}
              icon={<Box size={16} className="text-blue-400" />}
            />
            <MetricCard
              title="Files"
              value={currentStats?.totalFiles || 0}
              icon={<Layers size={16} className="text-emerald-400" />}
            />
            <MetricCard
              title="Git Churn (Top)"
              value={currentStats?.gitStats?.topChurnFiles[0]?.changes || 0}
              icon={<GitCommit size={16} className="text-purple-400" />}
              subtitle="Max changes"
            />
          </div>

          {/* Active Exclusions */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Filter size={14} /> Active Exclusion Rules
            </h3>
            <div className="flex flex-wrap gap-2">
              {currentStats?.excludedRules &&
                  currentStats.excludedRules.length > 0
                ? (
                  currentStats.excludedRules.map((rule, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400 font-mono"
                    >
                      {rule}
                    </span>
                  ))
                )
                : (
                  <span className="text-xs text-slate-500 italic">
                    No custom exclusions recorded.
                  </span>
                )}
            </div>
          </div>

          {/* Evolution Chart */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 h-[300px]">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">
              System Evolution
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ fontSize: "12px" }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="files"
                  name="Files"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="complexity"
                  name="Complexity"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="dependencies"
                  name="Deps"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Column 2: Hotspots & Complexity */}
        <div className="space-y-6">
          {/* Complexity Chart */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 h-[350px]">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center justify-between">
              <span>Deepest Nesting (Complexity)</span>
              <span className="text-xs text-slate-500 font-normal">
                Indent Levels
              </span>
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={complexityData.slice(0, 10)}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.5}
                  horizontal={false}
                />
                <XAxis type="number" stroke="#64748b" fontSize={10} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#1e293b" }}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                  }}
                />
                <Bar
                  dataKey="depth"
                  name="Max Indentation"
                  fill="#f59e0b"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Git Churn */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 h-[400px] overflow-hidden flex flex-col">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <GitCommit size={14} className="text-purple-400" />{" "}
              Hotspots (Most Changed)
            </h3>
            <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
              <div className="space-y-2">
                {hotspotData.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded hover:bg-slate-700/50 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div
                        className="text-xs font-mono text-slate-300 truncate"
                        title={file.fullPath}
                      >
                        {file.name}
                      </div>
                      <div
                        className="text-[10px] text-slate-500 truncate"
                        title={file.fullPath}
                      >
                        {file.fullPath}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500"
                          style={{
                            width: `${
                              Math.min(
                                100,
                                (file.changes /
                                  (hotspotData[0]?.changes || 1)) * 100,
                              )
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-6 text-right">
                        {file.changes}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Git History & New Files */}
        <div className="space-y-6">
          {/* New Files Trend */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 h-[300px]">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">
              File Creation Velocity
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={newFilesData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.5}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                  }}
                />
                <Bar
                  dataKey="count"
                  name="New Files"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Info Card */}
          <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 p-6 rounded-xl border border-indigo-500/20">
            <h3 className="text-indigo-400 font-semibold mb-2 flex items-center gap-2">
              <Hash size={16} /> Insights
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              This dashboard provides deep insights into codebase evolution. Use
              snapshots to track how complexity and dependencies grow over time.
              <br />
              <br />
              <strong>Hotspots</strong>{" "}
              identify files that change frequently—candidates for refactoring.
              <strong>Complexity</strong> highlights deeply nested logic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard(
  { title, value, icon, subtitle, trend }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    subtitle?: string;
    trend?: string | number;
  },
) {
  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
      <div className="flex justify-between items-start mb-2">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">
          {title}
        </span>
        {icon}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white font-mono">{value}</span>
        {trend && (
          <span
            className={`text-xs mb-1 ${
              Number(trend) > 0 ? "text-emerald-400" : "text-slate-500"
            }`}
          >
            {Number(trend) > 0 ? "+" : ""}
            {trend}
          </span>
        )}
      </div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}
      </div>}
    </div>
  );
}
