import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Layout } from './Layout.tsx';
import { DashboardPage } from '../pages/DashboardPage.tsx';
import { LandingPage } from '../pages/LandingPage.tsx';

export function RootHandler() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (user) {
        return (
            <Layout>
                <DashboardPage />
            </Layout>
        );
    }

    return <LandingPage />;
}
