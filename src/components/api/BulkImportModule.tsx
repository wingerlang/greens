import React, { useState, useRef } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { type FoodItem } from '../../models/types.ts';

interface Conflict {
    type: 'modified' | 'duplicate' | 'new';
    imported: FoodItem;
    existing?: FoodItem;
    selected: boolean;
}

export const BulkImportModule: React.FC = () => {
    const { foodItems, addFoodItem, updateFoodItem } = useData();
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [fileName, setFileName] = useState<string | null>(null);
    const [importStatus, setImportStatus] = useState<'idle' | 'analyzing' | 'resolved'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setImportStatus('analyzing');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                const importedItems = Array.isArray(json) ? json : [json];
                analyzeImports(importedItems);
            } catch (err) {
                alert('Felaktigt JSON-format!');
                setImportStatus('idle');
            }
        };
        reader.readAsText(file);
    };

    const analyzeImports = (items: any[]) => {
        const newConflicts: Conflict[] = [];

        items.forEach(importedRaw => {
            // Validation: Must have name and protein
            if (!importedRaw.name || importedRaw.protein === undefined) return;

            // Apply defaults for missing fields
            const imported: FoodItem = {
                id: importedRaw.id || `food-${importedRaw.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: importedRaw.name,
                calories: importedRaw.calories || 0,
                protein: importedRaw.protein,
                carbs: importedRaw.carbs || 0,
                fat: importedRaw.fat || 0,
                fiber: importedRaw.fiber || 0,
                unit: importedRaw.unit || 'kg',
                category: importedRaw.category || 'other',
                createdAt: importedRaw.createdAt || new Date().toISOString(),
                updatedAt: importedRaw.updatedAt || new Date().toISOString(),
                ...importedRaw
            };

            const existing = foodItems.find(f => f.id === imported.id || f.name.toLowerCase() === imported.name.toLowerCase());

            if (!existing) {
                newConflicts.push({ type: 'new', imported, selected: true });
            } else {
                const isSame =
                    existing.calories === imported.calories &&
                    existing.protein === imported.protein &&
                    existing.fat === imported.fat &&
                    existing.carbs === imported.carbs;

                if (isSame) {
                    newConflicts.push({ type: 'duplicate', imported, existing, selected: false });
                } else {
                    newConflicts.push({ type: 'modified', imported, existing, selected: true });
                }
            }
        });

        setConflicts(newConflicts);
        setImportStatus('resolved');
    };

    const toggleSelection = (index: number) => {
        setConflicts(prev => prev.map((c, i) => i === index ? { ...c, selected: !c.selected } : c));
    };

    const processImport = () => {
        let added = 0;
        let updated = 0;

        conflicts.filter(c => c.selected).forEach(c => {
            if (c.type === 'new') {
                addFoodItem(c.imported);
                added++;
            } else if (c.type === 'modified' && c.existing) {
                updateFoodItem(c.existing.id, c.imported);
                updated++;
            }
        });

        alert(`Klart! Lade till ${added} och uppdaterade ${updated} råvaror.`);
        reset();
    };

    const reset = () => {
        setConflicts([]);
        setFileName(null);
        setImportStatus('idle');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-6">
            <div className="p-8 border-2 border-dashed border-slate-700 rounded-2xl text-center bg-slate-800/20 hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json"
                    className="hidden"
                />
                <div className="text-4xl mb-2">📥</div>
                <h3 className="font-bold">{fileName || 'Klicka för att ladda upp JSON'}</h3>
                <p className="text-sm text-gray-400">Dra och släpp filer här eller välj från din dator</p>
            </div>

            {importStatus === 'resolved' && (
                <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
                    <h4 className="font-bold mb-4 flex items-center justify-between">
                        Analysresultat
                        <span className="text-sm font-normal text-gray-400">{conflicts.length} objekt hittades</span>
                    </h4>

                    <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {conflicts.map((c, i) => (
                            <div
                                key={i}
                                onClick={() => toggleSelection(i)}
                                className={`p-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${!c.selected ? 'opacity-40 grayscale-[0.5] border-slate-700' :
                                    c.type === 'new' ? 'bg-green-500/10 border-green-500/40' :
                                        c.type === 'modified' ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-900/10' :
                                            'bg-slate-700/20 border-slate-600/30'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${c.selected ? 'bg-blue-600 border-blue-500' : 'border-slate-600'
                                        }`}>
                                        {c.selected && <span className="text-[10px] text-white">✓</span>}
                                    </div>
                                    <span className="text-lg">
                                        {c.type === 'new' ? '➕' : c.type === 'modified' ? '⚠️' : '⏹️'}
                                    </span>
                                    <div>
                                        <div className="font-medium text-sm">{c.imported.name}</div>
                                        <div className="text-xs text-gray-500 italic">
                                            {c.type === 'new' ? 'Helt ny post' :
                                                c.type === 'modified' ? 'Värden skiljer sig' : 'Exakt kopia'}
                                        </div>
                                    </div>
                                </div>
                                {c.type === 'modified' && (
                                    <div className="text-[10px] text-amber-200/50 text-right">
                                        <div className="line-through opacity-50">{c.existing?.calories} kcal</div>
                                        <div className="font-bold text-amber-400">{c.imported.calories} kcal</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={processImport}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                        >
                            Verkställ Import
                        </button>
                        <button
                            onClick={reset}
                            className="px-6 bg-slate-700 hover:bg-slate-600 text-gray-300 font-bold py-3 rounded-xl transition-all"
                        >
                            Avbryt
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
