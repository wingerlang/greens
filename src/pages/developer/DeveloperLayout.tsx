
import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Terminal, FolderTree, Activity, FileCode, Settings, ListTodo } from 'lucide-react';
import { DeveloperProvider, useDeveloper } from './DeveloperContext.tsx';
import { Modal } from '../../components/common/Modal.tsx';

function SettingsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { excludedFolders, toggleExclusion } = useDeveloper();
    const commonFolders = ['src/data', 'data', 'src/api/utils/deps', 'dist', 'build', 'node_modules'];

    // Simple logic to add custom folder
    const [custom, setCustom] = useState('');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Developer Settings">
            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-2">Excluded Folders (Analysis & Explorer)</h3>
                    <div className="space-y-2">
                        {commonFolders.map(folder => (
                            <label key={folder} className="flex items-center gap-2 p-2 rounded bg-slate-800 cursor-pointer hover:bg-slate-700">
                                <input
                                    type="checkbox"
                                    checked={excludedFolders.includes(folder)}
                                    onChange={() => toggleExclusion(folder)}
                                    className="rounded border-slate-600 bg-slate-700 text-emerald-500"
                                />
                                <span className="text-slate-200 font-mono text-sm">{folder}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-700">
                     <h3 className="text-sm font-medium text-slate-400 mb-2">Add Custom Exclusion</h3>
                     <div className="flex gap-2">
                         <input
                            value={custom}
                            onChange={e => setCustom(e.target.value)}
                            placeholder="e.g. src/legacy"
                            className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                         />
                         <button
                            onClick={() => {
                                if (custom && !excludedFolders.includes(custom)) {
                                    toggleExclusion(custom);
                                    setCustom('');
                                }
                            }}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-medium"
                         >
                             Add
                         </button>
                     </div>
                     <div className="mt-2 space-y-1">
                         {excludedFolders.filter(f => !commonFolders.includes(f)).map(f => (
                             <div key={f} className="flex items-center justify-between p-2 rounded bg-slate-800 text-sm">
                                 <span className="font-mono text-slate-300">{f}</span>
                                 <button onClick={() => toggleExclusion(f)} className="text-red-400 hover:text-red-300">Remove</button>
                             </div>
                         ))}
                     </div>
                </div>
            </div>
        </Modal>
    );
}

function DevLayoutContent() {
    const [settingsOpen, setSettingsOpen] = useState(false);

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-200">
            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

            {/* Dev Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 bg-slate-800/50 border-b border-slate-700">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2 text-emerald-400 font-mono">
                        <Terminal size={20} />
                        <span className="font-bold">DEV_MODE</span>
                    </div>

                    <nav className="flex items-center gap-2">
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
                            to="/developer/todos"
                            className={({ isActive }) =>
                                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    isActive ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-700 text-slate-400'
                                }`
                            }
                        >
                            <div className="flex items-center gap-2">
                                <ListTodo size={16} />
                                Refactor Plan
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
                                Code Quality
                            </div>
                        </NavLink>
                    </nav>
                </div>

                <button
                    onClick={() => setSettingsOpen(true)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                >
                    <Settings size={20} />
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6">
                <Outlet />
            </div>
        </div>
    );
}

export function DeveloperLayout() {
    return (
        <DeveloperProvider>
            <DevLayoutContent />
        </DeveloperProvider>
    );
}
