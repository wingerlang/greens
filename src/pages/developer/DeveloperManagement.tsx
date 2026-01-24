import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useDeveloper } from "./DeveloperContext.tsx";
import {
  AlertCircle,
  CheckSquare,
  ChevronRight,
  FileText,
  Filter,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Comment {
  file: string;
  line: number;
  text: string;
  type: "todo" | "code" | "info";
  context: string[];
}

export function DeveloperManagement() {
  const { token } = useAuth();
  const { excludedFolders, refreshTrigger } = useDeveloper();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "todo" | "fixme">("all");
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);

  const query = new URLSearchParams({ excluded: excludedFolders.join(",") })
    .toString();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/developer/comments?${query}`, {
      headers: { "Authorization": `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        // Filter only todos/fixmes
        const todos = (data.comments || []).filter((c: Comment) =>
          c.type === "todo"
        );
        setComments(todos);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, refreshTrigger, query]);

  const filteredComments = comments.filter((c) => {
    if (filter === "all") return true;
    if (filter === "todo") return c.text.toLowerCase().includes("todo");
    if (filter === "fixme") return c.text.toLowerCase().includes("fixme");
    return true;
  });

  if (loading) {
    return (
      <div className="p-8 text-slate-400 animate-pulse">
        Scanning for TODOs...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6">
      {/* List */}
      <div className="w-1/3 flex flex-col bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <CheckSquare size={18} className="text-emerald-400" />
            Tasks ({filteredComments.length})
          </h2>
          <div className="flex bg-slate-700 rounded-md p-0.5">
            {["all", "todo", "fixme"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors uppercase ${
                  filter === f
                    ? "bg-slate-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto divide-y divide-slate-800">
          {filteredComments.map((comment, i) => (
            <div
              key={i}
              onClick={() => setSelectedComment(comment)}
              className={`p-4 cursor-pointer hover:bg-slate-800/50 transition-colors ${
                selectedComment === comment
                  ? "bg-indigo-900/20 border-l-2 border-indigo-500"
                  : "border-l-2 border-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase ${
                    comment.text.toLowerCase().includes("fixme")
                      ? "bg-red-500/20 text-red-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {comment.text.toLowerCase().includes("fixme")
                    ? "FIXME"
                    : "TODO"}
                </span>
                <span
                  className="text-xs text-slate-500 font-mono truncate max-w-[120px]"
                  title={comment.file}
                >
                  {comment.file.split("/").slice(-1)[0]}:{comment.line}
                </span>
              </div>
              <p className="text-sm text-slate-300 line-clamp-2">
                {comment.text.replace(/^(todo|fixme)[:\s]*/i, "")}
              </p>
            </div>
          ))}
          {filteredComments.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No tasks found matching filter.
            </div>
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
        {selectedComment
          ? (
            <>
              <div className="p-4 border-b border-slate-700 bg-slate-800">
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <FileText size={16} />
                  <span className="font-mono">{selectedComment.file}</span>
                  <span className="text-slate-600">
                    L{selectedComment.line}
                  </span>
                </div>
                <h3 className="text-lg font-medium text-white">
                  {selectedComment.text}
                </h3>
              </div>
              <div className="flex-1 bg-slate-950 p-4 overflow-auto">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Code Context
                </h4>
                <div className="rounded-lg overflow-hidden border border-slate-800">
                  <SyntaxHighlighter
                    language="typescript"
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: "1rem" }}
                    showLineNumbers
                    startingLineNumber={Math.max(1, selectedComment.line - 1)}
                    wrapLines
                    lineProps={(lineNumber) => {
                      return lineNumber === selectedComment.line
                        ? {
                          style: {
                            display: "block",
                            backgroundColor: "rgba(255, 180, 0, 0.1)",
                          },
                        }
                        : {};
                    }}
                  >
                    {selectedComment.context.join("\n")}
                  </SyntaxHighlighter>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      /* Integration with issue tracker could go here */
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition-colors border border-slate-600"
                  >
                    Open in Explorer
                  </button>
                </div>
              </div>
            </>
          )
          : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
              <CheckSquare size={48} className="text-slate-700" />
              <p>Select a task to view context</p>
            </div>
          )}
      </div>
    </div>
  );
}
