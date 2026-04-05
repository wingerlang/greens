import React from 'react';

interface NavSuggestionsModuleProps {
    navSuggestions: any[];
    selectedIndex: number;
    navigate: (path: string) => void;
    onClose: () => void;
    logEvent: (type: "other" | "change" | "click" | "copy" | "error" | "submit" | "omnibox_search" | "omnibox_log" | "omnibox_nav" | "quick_add_log" | "estimate_lunch_log" | "rage_click" | "dead_click", label: string, target?: string, metadata?: any) => void;
}

export const NavSuggestionsModule: React.FC<NavSuggestionsModuleProps> = ({
    navSuggestions,
    selectedIndex,
    navigate,
    onClose,
    logEvent
}) => {
    return (
        <div className="px-2 py-2">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span>🧭</span> Navigera ({navSuggestions.length})
            </div>
            {navSuggestions.map((route: any, idx) => (
                <div
                    key={route.path}
                    id={`omnibox-item-${idx}`}
                    onClick={() => { 
                        logEvent('omnibox_nav', `Navigated to ${route.label}`, 'omnibox', { path: route.path });
                        navigate(route.path); 
                        onClose(); 
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${idx === selectedIndex
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'hover:bg-white/5 text-white'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm">
                            {route.icon}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="font-medium">{route.label}</div>
                                <div className="flex items-center gap-1">
                                    {route.sortReason && (
                                        <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-bold uppercase transition-all" title="Varför denna visas först">
                                            🧭 {route.sortReason}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-500">{route.path}</div>
                        </div>
                    </div>
                </div>
            ))}
            <div className="px-2 py-1 text-[10px] text-slate-600 text-center">
                ↑↓ navigera • Enter för att öppna
            </div>
        </div>
    );
};
