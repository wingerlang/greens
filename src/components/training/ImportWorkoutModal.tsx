import React, { useState, useEffect, useRef } from 'react';

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
    const [pastedText, setPastedText] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleSubmit = async () => {
        let fileToUpload = selectedFile;

        if (!fileToUpload && pastedText) {
            // Create a file from the pasted text
            const blob = new Blob([pastedText], { type: 'text/csv' });
            fileToUpload = new File([blob], `pasted-${source}.csv`, { type: 'text/csv' });
        }

        if (!fileToUpload) return;
        await onImport(fileToUpload, source);
        setSelectedFile(null);
        setPastedText('');
    };

    // Early return AFTER all hooks
    if (!isOpen) return null;

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

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Alternativ 1: Ladda upp CSV-fil</label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${selectedFile
                                ? 'border-emerald-500/50 bg-emerald-500/5'
                                : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                                }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={(e) => {
                                    setSelectedFile(e.target.files?.[0] || null);
                                    if (e.target.files?.[0]) setPastedText('');
                                }}
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

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-800" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-slate-900 px-2 text-slate-500 font-bold">Eller</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Alternativ 2: Klistra in text</label>
                        <textarea
                            value={pastedText}
                            onChange={(e) => {
                                setPastedText(e.target.value);
                                if (e.target.value) setSelectedFile(null);
                            }}
                            placeholder="Klistra in innehållet från din CSV-fil här..."
                            className="w-full h-32 bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 resize-none font-mono"
                        />
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
                        disabled={(!selectedFile && !pastedText) || isImporting}
                        className="flex-1 py-3 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isImporting ? 'Importerar...' : 'Importera'}
                    </button>
                </div>
            </div>
        </div>
    );
}
