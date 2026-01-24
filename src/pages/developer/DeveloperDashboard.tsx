import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useDeveloper } from "./DeveloperContext.tsx";
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BookOpen, Camera, ExternalLink, FileText, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ProjectStats {
  totalFiles: number;
  totalLines: number;
  filesByExtension: Record<string, number>;
  linesByExtension: Record<string, number>;
}

interface DeveloperSnapshot {
  timestamp: number;
  stats: ProjectStats;
}

interface DocFile {
  name: string;
  path: string;
  content: string;
}

export function DeveloperDashboard() {
  const { token } = useAuth();
  const { excludedFolders, refreshTrigger } = useDeveloper();
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [history, setHistory] = useState<DeveloperSnapshot[]>([]);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocFile | null>(null);

  const query = new URLSearchParams({ excluded: excludedFolders.join(",") })
    .toString();

  useEffect(() => {
    Promise.all([
      fetch(`/api/developer/stats?${query}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((res) => res.json()),
      fetch("/api/developer/history", {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((res) => res.json()),
      fetch("/api/developer/docs", {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((res) => res.json()),
    ])
      .then(([statsData, historyData, docsData]) => {
        setStats(statsData.stats);
        setHistory(historyData.history || []);
        setDocs(docsData.docs || []);

        // Auto-snapshot if none for today
        if (statsData.stats && historyData.history) {
          const today = new Date().toISOString().split("T")[0];
          const hasToday = historyData.history.some((h: any) =>
            new Date(h.timestamp).toISOString().split("T")[0] === today
          );
          if (!hasToday) {
            takeSnapshot();
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, refreshTrigger, query]);

  const takeSnapshot = async () => {
    if (snapshotting) return;
    setSnapshotting(true);
    try {
      await fetch(`/api/developer/snapshot?${query}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      // Refresh history
      const res = await fetch("/api/developer/history", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSnapshotting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-slate-400 animate-pulse">
        Scanning codebase...
      </div>
    );
  }
  if (!stats) {
    return <div className="p-8 text-red-400">Failed to load stats.</div>;
  }

  const chartData = history.map((h) => ({
    date: new Date(h.timestamp).toLocaleDateString(),
    files: h.stats.totalFiles,
    lines: h.stats.totalLines,
    tsFiles: h.stats.filesByExtension["ts"] || 0,
    tsxFiles: h.stats.filesByExtension["tsx"] || 0,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Project Overview</h1>
        <button
          onClick={takeSnapshot}
          disabled={snapshotting}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium disabled:opacity-50"
        >
          <Camera size={16} />
          {snapshotting ? "Saving..." : "Take Snapshot"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Files" value={stats.totalFiles} />
        <StatCard
          title="Total Lines of Code"
          value={stats.totalLines.toLocaleString()}
        />
        <StatCard
          title="TypeScript Files"
          value={stats.filesByExtension["ts"] || 0}
        />
        <StatCard
          title="React Components"
          value={stats.filesByExtension["tsx"] || 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold mb-6 text-slate-200">
            Growth History
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                  itemStyle={{ color: "#e2e8f0" }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="lines"
                  name="Lines of Code"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="files"
                  name="Total Files"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Documentation Section */}
        <div className="lg:col-span-1 bg-slate-800 p-6 rounded-lg border border-slate-700 flex flex-col">
          <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
            <BookOpen size={20} className="text-purple-400" />
            Project Docs
          </h3>
          <div className="flex-1 space-y-2 overflow-auto">
            {docs.map((doc) => (
              <button
                key={doc.path}
                onClick={() => setSelectedDoc(doc)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-700 transition-colors border border-slate-700 hover:border-slate-600 group text-left"
              >
                <div className="flex items-center gap-3">
                  <FileText
                    size={16}
                    className="text-slate-400 group-hover:text-purple-400 transition-colors"
                  />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                    {doc.name}
                  </span>
                </div>
                <ExternalLink
                  size={14}
                  className="text-slate-600 group-hover:text-slate-400"
                />
              </button>
            ))}
            {docs.length === 0 && (
              <div className="text-slate-500 text-sm italic text-center p-4">
                No documentation files found.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-emerald-400">
            Lines by Language
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.linesByExtension)
              .sort(([, a], [, b]) => b - a)
              .map(([ext, lines]) => (
                <div key={ext} className="flex items-center justify-between">
                  <span className="text-slate-300 font-mono uppercase">
                    .{ext}
                  </span>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${(lines / stats.totalLines) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-slate-400 text-sm w-16 text-right">
                      {lines.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-blue-400">
            Files by Type
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.filesByExtension)
              .sort(([, a], [, b]) => b - a)
              .map(([ext, count]) => (
                <div key={ext} className="flex items-center justify-between">
                  <span className="text-slate-300 font-mono uppercase">
                    .{ext}
                  </span>
                  <span className="text-slate-400 font-mono">{count}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Doc Modal */}
      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50 rounded-t-xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={20} className="text-purple-400" />
                {selectedDoc.name}
              </h2>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selectedDoc.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-sm">
      <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">
        {title}
      </h3>
      <p className="text-3xl font-mono text-white mt-2">{value}</p>
    </div>
  );
}
