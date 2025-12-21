import React, { useState } from 'react';
import { DbSchemaModule } from '../components/api/DbSchemaModule.tsx';
import { BulkImportModule } from '../components/api/BulkImportModule.tsx';
import { ApiReferenceModule } from '../components/api/ApiReferenceModule.tsx';

type Tab = 'schema' | 'import' | 'api';

export const ApiPage: React.FC<{ headless?: boolean }> = ({ headless = false }) => {
    const [activeTab, setActiveTab] = useState<Tab>('import');

    return (
        <div className={`${headless ? '' : 'max-w-4xl mx-auto p-6'} space-y-8 animate-in fade-in duration-500`}>
            {!headless && (
                <header className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-white mb-2">
                            Developer & API
                        </h1>
                        <p className="text-gray-400">
                            Hantera databasen genom bulk-import och utforska API-strukturen.
                        </p>
                    </div>
                    <div className="p-4 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/20 glass-effect">
                        <div className="text-2xl font-bold">v1.2</div>
                        <div className="text-[10px] uppercase tracking-widest font-bold opacity-50">API Version</div>
                    </div>
                </header>
            )}

            {/* Navigation Tabs */}
            <nav className="flex bg-slate-800/50 p-1 rounded-2xl border border-slate-700/50">
                {(['import', 'schema', 'api'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all ${activeTab === tab
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 translate-y-[-1px]'
                            : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                    >
                        {tab === 'import' ? 'Bulk Import' :
                            tab === 'schema' ? 'Schema' : 'API Ref'}
                    </button>
                ))}
            </nav>

            <main className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl min-h-[500px]">
                {activeTab === 'schema' && <DbSchemaModule />}
                {activeTab === 'import' && <BulkImportModule />}
                {activeTab === 'api' && <ApiReferenceModule />}
            </main>

            {!headless && (
                <footer className="text-center text-gray-500 text-xs py-8">
                    Greens API Engine &bull; Developed for Advanced Agency &bull; 2025
                </footer>
            )}
        </div>
    );
};
