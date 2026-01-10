import React, { useState, useRef } from 'react';

type ImportSource = 'strengthlog' | 'hevy';

interface ImportWorkoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (file: File, source: ImportSource) => Promise<void>;
    isImporting: boolean;
}

export function ImportWorkoutModal({ isOpen, onClose, onImport, isImporting }: ImportWorkoutModalProps) {
    const [source, setSource] = useState<ImportSource>('strengthlog');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!selectedFile) return;
        await onImport(selectedFile, source);
        setSelectedFile(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-black text-white">Importera Pass</h2>
                        <p className="text-sm text-slate-400">Välj källa och ladda upp CSV</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => setSource('strengthlog')}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${source === 'strengthlog'
                            ? 'bg-purple-500/20 border-purple-500 text-white'
                            : 'bg-slate-950 border-white/5 text-slate-500 hover:bg-slate-800'
                            }`}
                    >
                        <span className="text-2xl">💪</span>
                        <span className="font-bold text-sm">StrengthLog</span>
                    </button>
                    <button
                        onClick={() => setSource('hevy')}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${source === 'hevy'
                            ? 'bg-blue-500/20 border-blue-500 text-white'
                            : 'bg-slate-950 border-white/5 text-slate-500 hover:bg-slate-800'
                            }`}
                    >
                        <span className="text-2xl">🏋️</span>
                        <span className="font-bold text-sm">Hevy</span>
                    </button>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">CSV Fil</label>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${selectedFile
                            ? 'border-emerald-500/50 bg-emerald-500/5'
                            : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                            }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="hidden"
                        />
                        {selectedFile ? (
                            <>
                                <span className="text-2xl mb-2">📄</span>
                                <span className="text-sm font-bold text-emerald-400">{selectedFile.name}</span>
                                <span className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                            </>
                        ) : (
                            <>
                                <span className="text-2xl mb-2">📥</span>
                                <span className="text-sm font-bold text-slate-400">Klicka för att välja fil</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 transition-colors"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedFile || isImporting}
                        className="flex-1 py-3 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isImporting ? 'Importerar...' : 'Importera'}
                    </button>
                </div>
            </div>
        </div>
    );
}
