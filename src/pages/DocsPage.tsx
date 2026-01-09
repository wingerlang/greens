import React from 'react';
import { DocumentationPage } from '../components/DocumentationPage.tsx';

export function DocsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header>
                <h1 className="text-3xl font-black tracking-tight text-white mb-2">📚 Dokumentation & Regler</h1>
                <p className="text-gray-400 text-sm uppercase tracking-widest font-semibold opacity-50">
                    Systemregler, enhetslogik och parsning
                </p>
            </header>

            <DocumentationPage headless={true} />
        </div>
    );
}
