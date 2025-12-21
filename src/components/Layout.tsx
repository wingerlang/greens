import React, { type ReactNode, useState, useEffect } from 'react';
import { Navigation } from './Navigation.tsx';
import { Omnibox } from './Omnibox.tsx';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const [isOmniboxOpen, setIsOmniboxOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOmniboxOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="min-h-screen flex flex-col relative">
            <Omnibox isOpen={isOmniboxOpen} onClose={() => setIsOmniboxOpen(false)} />
            <Navigation onOpenOmnibox={() => setIsOmniboxOpen(true)} />
            <main className="flex-1 w-full max-w-[1536px] mx-auto p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
