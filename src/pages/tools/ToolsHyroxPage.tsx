import React from "react";
import { HyroxDashboard } from "../../components/hyrox/HyroxDashboard.tsx";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function ToolsHyroxPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <Link
          to="/tools"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka till verktyg
        </Link>
      </div>

      <HyroxDashboard />
    </div>
  );
}
