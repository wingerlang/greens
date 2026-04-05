import React from 'react';

interface ActionSuggestionsModuleProps {
    actionSuggestions: any[];
    actionUsage: Record<string, number>;
    selectedIndex: number;
    setSelectedIndex: (idx: number) => void;
    handleExecuteAction: (action: any) => void;
}

export const ActionSuggestionsModule: React.FC<ActionSuggestionsModuleProps> = ({
    actionSuggestions,
    actionUsage,
    selectedIndex,
    setSelectedIndex,
    handleExecuteAction
}) => {
    return (
        <div className="px-2 py-2">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span>⚡</span> Systemåtgärder ({actionSuggestions.length})
            </div>
            {actionSuggestions.map((action, idx) => (
                <div
                    key={action.id}
                    id={`omnibox-item-${idx}`}
                    onClick={() => { setSelectedIndex(idx); handleExecuteAction(action); }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${idx === selectedIndex
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'hover:bg-white/5 text-white'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm">
                            {action.icon}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="font-medium">{action.label}</div>
                                {actionUsage[action.id] > 0 && (
                                    <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase">
                                        ⚡ {actionUsage[action.id]}
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-500">{action.description}</div>
                        </div>
                    </div>
                    <div className="text-[10px] font-mono text-slate-600">{action.command}</div>
                </div>
            ))}
            <div className="px-2 py-1 text-[10px] text-slate-600 text-center">
                ↑↓ navigera • Enter för att köra
            </div>
        </div>
    );
};
