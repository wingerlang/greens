import React, { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SystemInfo {
  denoVersion: any;
  memory: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
  };
  pid: number;
  uptime: string;
  kvStatus: string;
  dbSize: number;
  activeSessions: number;
  totalSessions: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  stack?: string;
  path?: string;
  method?: string;
}

interface Metrics {
  avgResponseTime: number;
  totalRequestsLogged: number;
  recentResponseTimes: { timestamp: string; value: number; tags?: any }[];
}

export const HealthModule: React.FC = () => {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const headers = { "Authorization": `Bearer ${token}` };

    try {
      const [sysRes, logsRes, metricsRes] = await Promise.all([
        fetch("/api/admin/health", { headers }),
        fetch("/api/admin/logs", { headers }),
        fetch("/api/admin/metrics", { headers }),
      ]);

      if (sysRes.ok) setSystem(await sysRes.json());
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics || null);
      }
    } catch (e) {
      console.error("Failed to fetch health data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading && !system) {
    return (
      <div className="p-8 text-center text-gray-500 animate-pulse">
        Laddar systemstatus...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            🩺
          </span>
          Systemhälsa & Prestanda
        </h2>
        <div className="text-xs text-gray-500 font-mono">
          Uppdateras live (10s)
        </div>
      </div>

      {/* System Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">
            Uptime
          </div>
          <div className="text-xl font-mono text-emerald-400">
            {system?.uptime || "-"}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">
            RAM (RSS)
          </div>
          <div className="text-xl font-mono text-blue-400">
            {system?.memory.rss || "-"}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">
            Databas (Keys)
          </div>
          <div className="text-xl font-mono text-amber-400">
            {system?.dbSize || "-"}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">
            Deno Version
          </div>
          <div className="text-xl font-mono text-gray-300">
            v{system?.denoVersion?.deno || "?"}
          </div>
        </div>
      </div>

      {/* Activity Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">
            Aktiva Användare
          </div>
          <div className="text-xl font-mono text-green-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse">
            </span>
            {system?.activeSessions || 0}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">
            Totalt Sessioner
          </div>
          <div className="text-xl font-mono text-gray-300">
            {system?.totalSessions || 0}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">
            Requests (Logged)
          </div>
          <div className="text-xl font-mono text-sky-400">
            {metrics?.totalRequestsLogged || 0}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-gray-500 font-bold uppercase mb-1">
            Avg Latency
          </div>
          <div className="text-xl font-mono text-pink-400">
            {Math.round(metrics?.avgResponseTime || 0)} ms
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-gray-300">
            Responstid (ms) - Senaste 50 förfrågningarna
          </h3>
          <div className="text-xs font-mono text-gray-500">
            Avg:{" "}
            <span className="text-emerald-400">
              {Math.round(metrics?.avgResponseTime || 0)}ms
            </span>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={metrics?.recentResponseTimes
                ? [...metrics.recentResponseTimes].reverse()
                : []}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timestamp" hide />
              <YAxis stroke="#475569" fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                }}
                labelStyle={{ display: "none" }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#10b981" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Error Logs */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-gray-300 flex items-center gap-2">
            <span>🚨</span> Senaste Fel
          </h3>
          <span className="text-xs bg-slate-800 px-2 py-1 rounded text-gray-400">
            {logs.length} händelser
          </span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/50 text-gray-500 sticky top-0">
              <tr>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">
                  Tid
                </th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">
                  Meddelande
                </th>
                <th className="px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">
                  Path
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {logs.length === 0
                ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      Inga fel loggade 🎉
                    </td>
                  </tr>
                )
                : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className="text-red-400 font-medium truncate max-w-md"
                          title={log.message}
                        >
                          {log.message}
                        </div>
                        {log.stack && (
                          <div className="hidden group-hover:block mt-2 text-[10px] font-mono text-gray-600 bg-black/20 p-2 rounded whitespace-pre-wrap max-w-xl">
                            {log.stack.split("\n")[1]?.trim()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-400">
                        {log.path || "-"}
                      </td>
                    </tr>
                  ))
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
