
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../models/types.ts';
import type { LoginStat } from '../api/db/stats.ts';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, email?: string) => Promise<void>;
    logout: () => void;
    error: string | null;
    fetchStats: () => Promise<LoginStat[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { safeFetch } from '../utils/http.ts';

// ... (keep interface)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);

    // Initial check
    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;
        let mounted = true;

        safeFetch<{ user: User }>('/api/auth/me', {
            signal
        })
            .then(data => {
                if (mounted && data) setUser(data.user);
            })
            .catch((e) => {
                if (e instanceof Error && e.name === 'AbortError') return;
                // console.error('[AuthContext] Auth check failed:', e instanceof Error ? e.message : String(e));
                if (mounted) {
                    setUser(null);
                }
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
            controller.abort();
        };
    }, []);

    const login = async (username: string, password: string) => {
        setError(null);
        try {
            const data = await safeFetch<{ user: User }>('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!data) throw new Error('No response from server');

            setUser(data.user);
        } catch (e: any) {
            const msg = e.body ? JSON.parse(e.body).error : e.message;
            setError(msg || 'Login failed');
            throw e;
        }
    };

    const register = async (username: string, password: string, email?: string) => {
        setError(null);
        try {
            const data = await safeFetch<{ user: User }>('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email })
            });

            if (!data) throw new Error('No response from server');

            setUser(data.user);
        } catch (e: any) {
            const msg = e.body ? JSON.parse(e.body).error : e.message;
            setError(msg || 'Registration failed');
            throw e;
        }
    };

    const logout = () => {
        safeFetch('/api/auth/logout', { method: 'POST' }).catch(console.error);
        setUser(null);
    };

    const fetchStats = async () => {
        try {
            const data = await safeFetch<{ stats: LoginStat[] }>('/api/auth/stats', {});
            if (data) {
                return data.stats;
            }
        } catch (e) {
            console.error(e);
        }
        return [];
    };

    return (
        <AuthContext.Provider value={{ user, loading, token, login, register, logout, error, fetchStats }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
