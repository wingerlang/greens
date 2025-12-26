import React, { useState } from 'react';

interface TabItem {
    id: string;
    label: string;
    content: React.ReactNode;
    icon?: string;
}

interface TabsProps {
    items: TabItem[];
    defaultTab?: string;
}

export function Tabs({ items, defaultTab }: TabsProps) {
    const [activeTab, setActiveTab] = useState(defaultTab || items[0].id);

    return (
        <div className="bg-slate-900/30 border border-white/5 rounded-3xl overflow-hidden">
            {/* Tab Header */}
            <div className="flex border-b border-white/5 overflow-x-auto custom-scrollbar">
                {items.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex-1 py-4 px-6 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative
                            ${activeTab === item.id
                                ? 'text-white bg-white/5'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            {item.icon && <span className="text-sm">{item.icon}</span>}
                            {item.label}
                        </div>
                        {activeTab === item.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 min-h-[300px]">
                {items.map(item => (
                    <div
                        key={item.id}
                        className={`transition-opacity duration-300 ${activeTab === item.id ? 'block opacity-100' : 'hidden opacity-0'}`}
                    >
                        {item.content}
                    </div>
                ))}
            </div>
        </div>
    );
}
