// Hook for session management
import { useCallback, useEffect, useState } from "react";
import { profileService } from "../../../services/profileService.ts";

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  lastActive?: string;
  userAgent?: string;
  ip?: string;
  isCurrent?: boolean;
  expires?: number; // timestamp
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

      // Client-side Filtering: Only show sessions active in the last 30 days or not expired
      const now = Date.now();
      const validSessions = (data || []).filter((s: Session) => {
        // If we have an expiration timestamp, use it
        if (s.expires && s.expires < now) return false;

        // If no expiration, check lastActive or createdAt (fallback 30 days)
        const lastActivity = s.lastActive
          ? new Date(s.lastActive).getTime()
          : new Date(s.createdAt).getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;

        return (now - lastActivity) < thirtyDays;
      });

      setSessions(validSessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
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

  const currentSession = sessions.find((s) => s.isCurrent) || null;
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return {
    sessions,
    loading,
    error,
    currentSession,
    otherSessions,
    revokeSession,
    revokeAllOther,
    refresh: load,
  };
}
