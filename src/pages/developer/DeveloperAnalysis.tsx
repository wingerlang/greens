import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useDeveloper } from "./DeveloperContext.tsx";
import {
  AlertTriangle,
  Box,
  Check,
  Copy,
  FileWarning,
  FileX,
  GitMerge,
  Layers,
  MessageSquare,
  Network,
  Settings,
  Sliders,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeIssue {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  file: string;
  relatedFile?: string;
  details?: string;
}

interface DuplicateFunction {
  nameA: string;
  nameB: string;
  fileA: string;
  fileB: string;
  similarity: number;
}

interface SimilarFilePair {
  fileA: string;
  fileB: string;
  similarity: number;
  sharedTerms: string[];
}

interface UnusedFile {
  path: string;
}

interface CodeComment {
  file: string;
  line: number;
  text: string;
  type: "todo" | "code" | "info";
  context?: string[];
}

interface Dependency {
  name: string;
  version: string;
  type: "prod" | "dev";
}

export function DeveloperAnalysis() {
  const { token } = useAuth();
  const { excludedFolders, refreshTrigger } = useDeveloper();
  const [issues, setIssues] = useState<CodeIssue[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateFunction[]>([]);
  const [clusters, setClusters] = useState<SimilarFilePair[]>([]);
  const [unusedFiles, setUnusedFiles] = useState<string[]>([]);
  const [comments, setComments] = useState<CodeComment[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState<
    | "issues"
    | "duplicates"
    | "clusters"
    | "unused"
    | "comments"
    | "routes"
    | "deps"
  >("issues");
  const [maxLines, setMaxLines] = useState<number>(300);
  const [showSettings, setShowSettings] = useState(false);

  const query = new URLSearchParams({ excluded: excludedFolders.join(",") })
    .toString();

  useEffect(() => {
    const savedMaxLines = localStorage.getItem("dev_tools_max_lines");
    if (savedMaxLines) setMaxLines(parseInt(savedMaxLines, 10));
  }, []);

  const handleMaxLinesChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setMaxLines(num);
      localStorage.setItem("dev_tools_max_lines", num.toString());
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/developer/analysis?${query}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/developer/functions?${query}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/developer/similarity?${query}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/developer/unused?${query}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/developer/comments?${query}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch("/api/developer/routes", {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch("/api/developer/dependencies", {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/developer/report?${query}`, {
        headers: { "Authorization": `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(
        (
          [
            analysisData,
            funcsData,
            simData,
            unusedData,
            commentsData,
            routesData,
            depsData,
            reportData,
          ],
        ) => {
          setIssues(analysisData.issues || []);
          setDuplicates(funcsData.duplicates || []);
          setClusters(simData.clusters || []);
          setUnusedFiles(unusedData.unused || []);
          setComments(commentsData.comments || []);
          setRoutes(routesData.routes || []);
          setDependencies(depsData.dependencies || []);
          setReport(reportData.report || "");
        },
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, refreshTrigger, query]);

  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createTodo = async (
    desc: string,
    file: string,
    type: "duplicate" | "unused" | "comment",
  ) => {
    await fetch("/api/developer/todos", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description: desc, file, type }),
    });
    alert("Todo created!");
  };

  if (loading) {
    return (
      <div className="p-8 text-slate-400 animate-pulse">
        Running advanced analysis...
      </div>
    );
  }

  const filteredIssues = issues.filter((issue) => {
    if (issue.type === "large_file") {
      const match = issue.message.match(/(\d+) lines/);
      if (match) {
        const lines = parseInt(match[1], 10);
        return lines > maxLines;
      }
    }
    return true;
  });

  const codeComments = comments.filter((c) => c.type === "code");
  const todoComments = comments.filter((c) => c.type === "todo");

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {/* Header / Settings Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between bg-slate-900 p-4 rounded-lg border border-slate-700 gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 overflow-x-auto pb-2 sm:pb-0">
          <div className="flex items-center gap-2 text-white font-semibold mr-4 whitespace-nowrap">
            <FileWarning className="text-amber-400" />
            <span>Analysis</span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2">
            <TabButton
              active={activeTab === "issues"}
              onClick={() => setActiveTab("issues")}
              icon={<AlertTriangle size={14} />}
              label="Issues"
              count={filteredIssues.length}
            />
            <TabButton
              active={activeTab === "duplicates"}
              onClick={() => setActiveTab("duplicates")}
              icon={<GitMerge size={14} />}
              label="Duplicates"
              count={duplicates.length}
            />
            <TabButton
              active={activeTab === "unused"}
              onClick={() => setActiveTab("unused")}
              icon={<FileX size={14} />}
              label="Unused"
              count={unusedFiles.length}
            />
            <TabButton
              active={activeTab === "comments"}
              onClick={() => setActiveTab("comments")}
              icon={<MessageSquare size={14} />}
              label="Comments"
              count={comments.length}
            />
            <TabButton
              active={activeTab === "routes"}
              onClick={() => setActiveTab("routes")}
              icon={<Network size={14} />}
              label="Routes"
              count={routes.length}
            />
            <TabButton
              active={activeTab === "deps"}
              onClick={() => setActiveTab("deps")}
              icon={<Box size={14} />}
              label="Deps"
              count={dependencies.length}
            />
          </div>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
            showSettings
              ? "bg-indigo-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          <Settings size={14} />
          Settings
        </button>
      </div>

      {showSettings && (
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Sliders size={14} />
            Configuration
          </h3>
          <div className="flex items-center gap-4">
            <label className="text-sm text-slate-400">
              Max Lines per File:
            </label>
            <input
              type="number"
              value={maxLines}
              onChange={(e) => handleMaxLinesChange(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-white w-24 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-slate-500 italic">
              Files larger than this will be flagged.
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "issues" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <IssuesList issues={filteredIssues} />
            <AgentReport report={report} onCopy={handleCopy} copied={copied} />
          </div>
        )}

        {activeTab === "duplicates" && (
          <DuplicatesList
            duplicates={duplicates}
            onCreateTodo={createTodo}
            token={token}
          />
        )}
        {activeTab === "clusters" && <ClustersList clusters={clusters} />}

        {activeTab === "unused" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unusedFiles.map((f) => (
              <div
                key={f}
                className="bg-slate-800 p-3 rounded border border-slate-700 flex justify-between items-center group"
              >
                <span className="font-mono text-xs text-red-300">{f}</span>
                <button
                  onClick={() =>
                    createTodo(`Remove unused file: ${f}`, f, "unused")}
                  className="opacity-0 group-hover:opacity-100 p-1 bg-slate-700 text-slate-300 rounded hover:bg-emerald-600 hover:text-white"
                >
                  + Todo
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "comments" && (
          <div className="space-y-6">
            {codeComments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-amber-400 font-semibold sticky top-0 bg-slate-900 py-2">
                  Suspicious Code Comments ({codeComments.length})
                </h3>
                {codeComments.map((c, i) => (
                  <CommentCard
                    key={i}
                    comment={c}
                    onCreateTodo={createTodo}
                    token={token}
                  />
                ))}
              </div>
            )}
            {todoComments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-blue-400 font-semibold sticky top-0 bg-slate-900 py-2">
                  TODOs ({todoComments.length})
                </h3>
                {todoComments.map((c, i) => (
                  <div
                    key={i}
                    className="bg-slate-800 p-3 rounded border border-slate-700 flex justify-between items-center group"
                  >
                    <div>
                      <div className="text-xs font-mono text-slate-500">
                        {c.file}:{c.line}
                      </div>
                      <div className="text-slate-300 text-sm mt-1">
                        {c.text}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        createTodo(
                          `Address TODO: ${c.text}`,
                          c.file,
                          "comment",
                        )}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-emerald-600 hover:text-white"
                    >
                      + Task
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "routes" && (
          <div className="bg-slate-800 rounded border border-slate-700 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {routes.map((r) => (
                <div
                  key={r}
                  className="font-mono text-sm text-emerald-400 bg-slate-900 px-3 py-2 rounded"
                >
                  {r}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "deps" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-slate-300 font-semibold mb-4">Production</h3>
              <div className="space-y-2">
                {dependencies.filter((d) => d.type === "prod").map((d) => (
                  <div
                    key={d.name}
                    className="flex justify-between bg-slate-800 p-2 rounded border border-slate-700"
                  >
                    <span className="text-slate-200">{d.name}</span>
                    <span className="text-slate-500 font-mono text-sm">
                      {d.version}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-slate-300 font-semibold mb-4">Dev</h3>
              <div className="space-y-2">
                {dependencies.filter((d) => d.type === "dev").map((d) => (
                  <div
                    key={d.name}
                    className="flex justify-between bg-slate-800 p-2 rounded border border-slate-700"
                  >
                    <span className="text-slate-200">{d.name}</span>
                    <span className="text-slate-500 font-mono text-sm">
                      {d.version}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton(
  { active, onClick, icon, label, count }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    count: number;
  },
) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full ${
            active
              ? "bg-indigo-400/30 text-indigo-100"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function IssuesList({ issues }: { issues: CodeIssue[] }) {
  const highSeverity = issues.filter((i) => i.severity === "high");
  const mediumSeverity = issues.filter((i) => i.severity === "medium");

  return (
    <div className="space-y-6 overflow-auto pr-2">
      {issues.length === 0 && (
        <div className="p-4 bg-emerald-900/20 border border-emerald-800 rounded-lg text-emerald-400">
          No major issues detected! Good job.
        </div>
      )}
      {highSeverity.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">
            Critical ({highSeverity.length})
          </h3>
          {highSeverity.map((issue, i) => <IssueCard key={i} issue={issue} />)}
        </div>
      )}
      {mediumSeverity.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
            Warnings ({mediumSeverity.length})
          </h3>
          {mediumSeverity.map((issue, i) => (
            <IssueCard key={i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentCard(
  { comment, onCreateTodo, token }: {
    comment: CodeComment;
    onCreateTodo: (d: string, f: string, t: "comment") => void;
    token: string | null;
  },
) {
  const [expanded, setExpanded] = useState(false);
  const [fullContext, setFullContext] = useState<string | null>(null);

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (fullContext) {
      setExpanded(true);
      return;
    }

    try {
      const res = await fetch(
        `/api/developer/file?path=${encodeURIComponent(comment.file)}`,
        {
          headers: { "Authorization": `Bearer ${token}` },
        },
      ).then((r) => r.json());

      if (res.content) {
        const lines = res.content.split("\n");
        const startLine = Math.max(1, comment.line - 5);
        const endLine = Math.min(lines.length, comment.line + 5);

        // Adjust for 0-based index for slice
        const content = lines.slice(startLine - 1, endLine).join("\n");
        setFullContext(content);
        setExpanded(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-slate-800 p-3 rounded border border-slate-700 group">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono text-slate-500">
          {comment.file}:{comment.line}
        </span>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleExpand}
            className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded hover:bg-indigo-600 hover:text-white"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button
            onClick={() =>
              createTodo(
                `Investigate code: ${comment.file}`,
                comment.file,
                "comment",
              )}
            className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded hover:bg-emerald-600 hover:text-white"
          >
            + Todo
          </button>
        </div>
      </div>

      {expanded && fullContext
        ? (
          <SyntaxHighlighter
            language="typescript"
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: "0.5rem", fontSize: "12px" }}
            showLineNumbers
            startingLineNumber={Math.max(1, comment.line - 5)}
          >
            {fullContext}
          </SyntaxHighlighter>
        )
        : (
          <div className="font-mono text-xs">
            {comment.context?.[0] && (
              <div className="text-slate-600 px-2 select-none border-l-2 border-transparent">
                {comment.context[0]}
              </div>
            )}
            <div className="border-l-2 border-amber-500/50">
              <SyntaxHighlighter
                language="typescript"
                style={vscDarkPlus}
                customStyle={{ margin: 0, padding: "0.5rem", fontSize: "12px" }}
              >
                {comment.text}
              </SyntaxHighlighter>
            </div>
            {comment.context?.[1] && (
              <div className="text-slate-600 px-2 select-none border-l-2 border-transparent">
                {comment.context[1]}
              </div>
            )}
          </div>
        )}
    </div>
  );
}

function DuplicatesList(
  { duplicates, onCreateTodo, token }: {
    duplicates: DuplicateFunction[];
    onCreateTodo: (desc: string, file: string, type: "duplicate") => void;
    token: string | null;
  },
) {
  const [selectedDup, setSelectedDup] = useState<DuplicateFunction | null>(
    null,
  );
  const [fileAContent, setFileAContent] = useState<string>("");
  const [fileBContent, setFileBContent] = useState<string>("");
  const [loadingDiff, setLoadingDiff] = useState(false);

  const openDiff = async (dup: DuplicateFunction) => {
    setSelectedDup(dup);
    setLoadingDiff(true);
    try {
      const headers = { "Authorization": `Bearer ${token}` };
      const [resA, resB] = await Promise.all([
        fetch(`/api/developer/file?path=${encodeURIComponent(dup.fileA)}`, {
          headers,
        }).then((r) => r.json()),
        fetch(`/api/developer/file?path=${encodeURIComponent(dup.fileB)}`, {
          headers,
        }).then((r) => r.json()),
      ]);
      setFileAContent(resA.content || "Error loading file");
      setFileBContent(resB.content || "Error loading file");
    } catch (e) {
      setFileAContent("Error loading file");
      setFileBContent("Error loading file");
    }
    setLoadingDiff(false);
  };

  if (duplicates.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 italic">
        No similar functions found.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {duplicates.map((d, i) => (
          <div
            key={i}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-indigo-500/50 transition-colors group relative cursor-pointer"
            onClick={() => openDiff(d)}
          >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateTodo(
                    `Refactor duplicate function: ${d.nameA}`,
                    d.fileA,
                    "duplicate",
                  );
                }}
                className="p-1.5 bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white rounded"
                title="Add to Todo"
              >
                <Check size={14} />
              </button>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-1 rounded font-mono">
                {(d.similarity * 100).toFixed(0)}% Match
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div
                  className="font-mono text-sm text-white font-semibold truncate"
                  title={d.nameA}
                >
                  {d.nameA}
                </div>
                <div
                  className="text-xs text-slate-500 truncate"
                  title={d.fileA}
                >
                  {d.fileA}
                </div>
              </div>
              <div className="flex justify-center text-slate-600">
                <GitMerge size={16} className="rotate-90" />
              </div>
              <div>
                <div
                  className="font-mono text-sm text-white font-semibold truncate"
                  title={d.nameB}
                >
                  {d.nameB}
                </div>
                <div
                  className="text-xs text-slate-500 truncate"
                  title={d.fileB}
                >
                  {d.fileB}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Diff Modal */}
      {selectedDup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedDup(null)}
          />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800">
              <div className="flex items-center gap-4">
                <GitMerge className="text-indigo-400" size={20} />
                <span className="text-white font-semibold">
                  Diff: {selectedDup.nameA}
                </span>
                <span className="text-indigo-400 text-xs font-mono bg-indigo-500/10 px-2 py-1 rounded">
                  {(selectedDup.similarity * 100).toFixed(0)}% Match
                </span>
              </div>
              <button
                onClick={() => setSelectedDup(null)}
                className="p-2 text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {loadingDiff
                ? (
                  <div className="flex items-center justify-center h-64 text-slate-400">
                    Loading files...
                  </div>
                )
                : (
                  <div className="grid grid-cols-2 divide-x divide-slate-700 h-full">
                    <div className="flex flex-col">
                      <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700 text-xs font-mono text-slate-400">
                        {selectedDup.fileA}
                      </div>
                      <pre className="p-4 text-xs font-mono text-slate-300 overflow-auto flex-1 whitespace-pre-wrap">{fileAContent}</pre>
                    </div>
                    <div className="flex flex-col">
                      <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700 text-xs font-mono text-slate-400">
                        {selectedDup.fileB}
                      </div>
                      <pre className="p-4 text-xs font-mono text-slate-300 overflow-auto flex-1 whitespace-pre-wrap">{fileBContent}</pre>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ClustersList({ clusters }: { clusters: SimilarFilePair[] }) {
  if (clusters.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 italic">
        No file clusters found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {clusters.map((c, i) => (
        <div
          key={i}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-slate-300 font-medium text-sm">
              Semantic Similarity
            </h4>
            <span className="text-emerald-400 text-xs font-mono">
              {(c.similarity * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            <div className="bg-slate-900 px-3 py-2 rounded border border-slate-700 text-xs font-mono text-slate-400 truncate">
              {c.fileA}
            </div>
            <div className="bg-slate-900 px-3 py-2 rounded border border-slate-700 text-xs font-mono text-slate-400 truncate">
              {c.fileB}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {c.sharedTerms.map((term) => (
              <span
                key={term}
                className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300"
              >
                {term}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentReport(
  { report, onCopy, copied }: {
    report: string;
    onCopy: () => void;
    copied: boolean;
  },
) {
  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <span className="font-mono text-sm text-slate-400">
          agent_report.md
        </span>
        <button
          onClick={onCopy}
          className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "COPIED" : "COPY FOR AGENT"}
        </button>
      </div>
      <textarea
        readOnly
        className="flex-1 w-full bg-slate-950 p-4 text-slate-300 font-mono text-sm resize-none focus:outline-none"
        value={report}
      />
    </div>
  );
}

function IssueCard({ issue }: { issue: CodeIssue }) {
  const color = issue.severity === "high"
    ? "border-red-500/50 bg-red-500/10"
    : "border-amber-500/50 bg-amber-500/10";

  return (
    <div className={`p-4 rounded-lg border ${color}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={18}
          className={issue.severity === "high"
            ? "text-red-400"
            : "text-amber-400"}
        />
        <div>
          <h4 className="font-semibold text-slate-200">{issue.message}</h4>
          <p className="text-xs font-mono text-slate-400 mt-1">{issue.file}</p>
          {issue.relatedFile && (
            <p className="text-xs font-mono text-slate-500 mt-1">
              ↳ {issue.relatedFile}
            </p>
          )}
          {issue.details && (
            <p className="text-sm text-slate-400 mt-2 italic">
              "{issue.details}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
