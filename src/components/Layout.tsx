import React, { type ReactNode } from 'react';
import { Navigation } from './Navigation.tsx';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen flex flex-col">
            <Navigation />
            <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
