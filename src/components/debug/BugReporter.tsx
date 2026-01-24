import React, { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Bug, Camera, Check, Loader2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";

interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function BugReporter() {
  // Only show in DEV mode
  if (!import.meta.env.DEV) return null;

  const { user, token } = useAuth();
  const [active, setActive] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Selection state
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  // Force render on mouse move during selection
  const [, setTick] = useState(0);

  useEffect(() => {
    if (selecting) {
      document.body.style.cursor = "crosshair";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }, [selecting]);

  // Console log capture
  const logs = useRef<string[]>([]);
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const capture = (type: string, args: any[]) => {
      try {
        const msg = args.map((a) =>
          typeof a === "object" ? JSON.stringify(a) : String(a)
        ).join(" ");
        logs.current.push(`[${type}] ${msg}`);
        if (logs.current.length > 50) logs.current.shift();
      } catch (e) {}
    };

    console.log = (...args) => {
      capture("LOG", args);
      originalLog.apply(console, args);
    };
    console.error = (...args) => {
      capture("ERR", args);
      originalError.apply(console, args);
    };
    console.warn = (...args) => {
      capture("WARN", args);
      originalWarn.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selecting) return;
    startPos.current = { x: e.clientX, y: e.clientY };
    setSelection({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selecting) return;
    if (startPos.current) {
      const x = Math.min(e.clientX, startPos.current.x);
      const y = Math.min(e.clientY, startPos.current.y);
      const w = Math.abs(e.clientX - startPos.current.x);
      const h = Math.abs(e.clientY - startPos.current.y);
      setSelection({ x, y, w, h });
    }
  };

  const handleMouseUp = async () => {
    if (!selecting || !startPos.current) return;
    setSelecting(false);
    startPos.current = null;

    // Capture
    await captureScreen();
  };

  const captureScreen = async () => {
    setLoading(true);
    try {
      // Hide reporter UI for capture
      const fab = document.getElementById("bug-reporter-fab");
      if (fab) fab.style.display = "none";

      const canvas = await html2canvas(document.body);

      if (fab) fab.style.display = "flex";

      // If selection exists, crop
      if (selection && selection.w > 0 && selection.h > 0) {
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = selection.w;
        croppedCanvas.height = selection.h;
        const ctx = croppedCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            canvas,
            selection.x,
            selection.y,
            selection.w,
            selection.h,
            0,
            0,
            selection.w,
            selection.h,
          );
          setSnapshot(croppedCanvas.toDataURL("image/png"));
        } else {
          setSnapshot(canvas.toDataURL("image/png"));
        }
      } else {
        setSnapshot(canvas.toDataURL("image/png"));
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setActive(true); // Open modal
  };

  const handleSubmit = async () => {
    if (!token) {
      alert("You must be logged in to report bugs.");
      return;
    }

    setLoading(true);
    try {
      await fetch("/api/developer/capture-context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: snapshot,
          route: window.location.href, // full url
          description,
          logs: logs.current,
          selection,
        }),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setActive(false);
        setSnapshot(null);
        setSelection(null);
        setDescription("");
      }, 2000);
    } catch (e) {
      console.error(e);
      alert("Failed to submit bug report");
    }
    setLoading(false);
  };

  // Hotkey listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + B
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "B") {
        e.preventDefault();
        setSelecting(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (selecting) {
    return (
      <div
        className="fixed inset-0 z-[100000] cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Dim background hole logic is complex, simple overlay for now */}
        <div className="absolute inset-0 bg-black/30" />
        {selection && (
          <div
            className="absolute border-2 border-green-500 bg-white/10 checkbox-transparent"
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.w,
              height: selection.h,
            }}
          />
        )}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-semibold pointer-events-none">
          Select an area to capture
        </div>
      </div>
    );
  }

  if (active && snapshot) {
    return (
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => setActive(false)}
        />
        <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
          <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Bug className="text-red-400" size={20} />
              Report Bug
            </h3>
            <button onClick={() => setActive(false)}>
              <X className="text-slate-400" />
            </button>
          </div>

          <div className="p-6 overflow-auto">
            <div className="mb-4">
              <label className="block text-xs font-mono text-slate-400 mb-2">
                SNAPSHOT
              </label>
              <img
                src={snapshot}
                className="w-full rounded border border-slate-700 object-contain max-h-60 bg-black"
                alt="Bug Snapshot"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-2">
                DESCRIPTION
              </label>
              <textarea
                className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-300 min-h-[100px] focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="What went wrong? What did you expect?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-end gap-3">
            <button
              onClick={() => setActive(false)}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !description}
              className={`px-6 py-2 rounded font-semibold text-white flex items-center gap-2 transition-all ${
                success
                  ? "bg-green-600"
                  : "bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              {loading
                ? <Loader2 className="animate-spin" size={18} />
                : success
                ? <Check size={18} />
                : <Bug size={18} />}
              {success ? "Reported!" : "Create Report"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="bug-reporter-fab"
      className="fixed top-1/2 right-0 -translate-y-1/2 z-[100000] group flex items-center"
    >
      <button
        onClick={() => setSelecting(true)}
        className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-l-lg shadow-lg transition-transform hover:-translate-x-1 active:scale-95 flex items-center gap-1"
        title="Report Bug (Ctrl+Shift+B)"
      >
        <Bug size={20} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 whitespace-nowrap text-xs font-bold">
          Report
        </span>
      </button>
    </div>
  );
}
