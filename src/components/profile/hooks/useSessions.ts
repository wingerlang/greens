// Hook for session management
import { useState, useEffect, useCallback } from 'react';
import { profileService } from '../../../services/profileService.ts';

export interface Session {
    token: string;
    userId: string;
    createdAt: string;
    lastActive?: string;
    userAgent?: string;
    ip?: string;
    isCurrent?: boolean;
}

export interface UseSessionsResult {
    sessions: Session[];
    loading: boolean;
    error: string | null;
    currentSession: Session | null;
    otherSessions: Session[];
    revokeSession: (token: string) => Promise<boolean>;
    revokeAllOther: () => Promise<boolean>;
    refresh: () => Promise<void>;
}

export function useSessions(): UseSessionsResult {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await profileService.getSessions();
            setSessions(data || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load sessions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const revokeSession = async (token: string): Promise<boolean> => {
        const success = await profileService.revokeSession(token);
        if (success) {
            await load();
        }
        return success;
    };

    const revokeAllOther = async (): Promise<boolean> => {
        const success = await profileService.revokeAllOtherSessions();
        if (success) {
            await load();
        }
        return success;
    };

    const currentSession = sessions.find(s => s.isCurrent) || null;
    const otherSessions = sessions.filter(s => !s.isCurrent);

    return {
        sessions,
        loading,
        error,
        currentSession,
        otherSessions,
        revokeSession,
        revokeAllOther,
        refresh: load
    };
}
