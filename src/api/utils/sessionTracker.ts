
export interface ClientError {
    message: string;
    source?: string;
    lineno?: number;
    colno?: number;
    stack?: string;
    timestamp: string;
    userAgent: string;
    ip: string;
}

export interface Session {
    id: string; // IP + UserAgent hash or just IP
    ip: string;
    userAgent: string;
    username?: string;
    userId?: string;
    firstSeen: string;
    lastSeen: string;
    path: string;
    method: string;
    errorCount: number;
}

class SessionTracker {
    private sessions: Map<string, Session> = new Map();
    private clientErrors: ClientError[] = [];
    private MAX_ERRORS = 100;
    private MAX_SESSIONS = 1000;

    track(req: Request, ip: string, user?: { id: string, username: string }) {
        const userAgent = req.headers.get("user-agent") || "unknown";
        const url = new URL(req.url);

        // Simple session ID based on IP and UA
        // If we have a user, we can potentially track by user ID, but sticking to IP/UA maps physically distinct clients better for now
        const sessionId = `${ip}|${userAgent}`;

        const now = new Date().toISOString();

        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            session.lastSeen = now;
            session.path = url.pathname;
            session.method = req.method;
            if (user) {
                session.username = user.username;
                session.userId = user.id;
            }
        } else {
            // Prune if too many
            if (this.sessions.size >= this.MAX_SESSIONS) {
                // Remove oldest
                const oldest = [...this.sessions.entries()].sort((a, b) => a[1].lastSeen.localeCompare(b[1].lastSeen))[0];
                if (oldest) this.sessions.delete(oldest[0]);
            }

            this.sessions.set(sessionId, {
                id: sessionId,
                ip,
                userAgent,
                username: user?.username,
                userId: user?.id,
                firstSeen: now,
                lastSeen: now,
                path: url.pathname,
                method: req.method,
                errorCount: 0
            });
        }
    }

    logClientError(error: Omit<ClientError, 'timestamp' | 'ip'>, ip: string) {
        const errorEntry: ClientError = {
            ...error,
            timestamp: new Date().toISOString(),
            ip
        };

        this.clientErrors.unshift(errorEntry);
        if (this.clientErrors.length > this.MAX_ERRORS) {
            this.clientErrors.pop();
        }

        // Update session error count
        const sessionId = `${ip}|${error.userAgent}`;
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            session.errorCount++;
            session.lastSeen = errorEntry.timestamp;
        }
    }

    getSessions() {
        // Return sorted by lastSeen desc
        return [...this.sessions.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
    }

    getErrors() {
        return this.clientErrors;
    }
}

export const sessionTracker = new SessionTracker();
