
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Terminal, FolderTree, Activity, FileCode } from 'lucide-react';

export function DeveloperLayout() {
    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-200">
            {/* Dev Toolbar */}
            <div className="flex items-center gap-4 px-6 py-3 bg-slate-800/50 border-b border-slate-700">
                <div className="flex items-center gap-2 text-emerald-400 font-mono">
                    <Terminal size={20} />
                    <span className="font-bold">DEV_MODE</span>
                </div>

                <nav className="flex items-center gap-2 ml-8">
                    <NavLink
                        to="/developer"
                        end
                        className={({ isActive }) =>
                            `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                isActive ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-700 text-slate-400'
                            }`
                        }
                    >
                        <div className="flex items-center gap-2">
                            <Activity size={16} />
                            Dashboard
                        </div>
                    </NavLink>

                    <NavLink
                        to="/developer/explorer"
                        className={({ isActive }) =>
                            `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                isActive ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-700 text-slate-400'
                            }`
                        }
                    >
                         <div className="flex items-center gap-2">
                            <FolderTree size={16} />
                            Explorer
                        </div>
                    </NavLink>

                    <NavLink
                        to="/developer/analysis"
                        className={({ isActive }) =>
                            `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                isActive ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-700 text-slate-400'
                            }`
                        }
                    >
                         <div className="flex items-center gap-2">
                            <FileCode size={16} />
                            Analysis & Agent
                        </div>
                    </NavLink>
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6">
                <Outlet />
            </div>
        </div>
    );
}
