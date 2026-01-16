import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import { PageView, InteractionEvent, generateId } from '../models/types.ts';

interface AnalyticsContextType {
    logEvent: (type: InteractionEvent['type'], label: string, target?: string, metadata?: any) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const { user } = useAuth();

    // Session Management
    const [sessionId] = useState(() => {
        const stored = sessionStorage.getItem('analytics_session_id');
        const timestamp = sessionStorage.getItem('analytics_session_ts');
        const now = Date.now();

        // Reset session if > 30 mins inactivity or missing
        if (stored && timestamp && (now - parseInt(timestamp) < 30 * 60 * 1000)) {
            sessionStorage.setItem('analytics_session_ts', now.toString());
            return stored;
        }

        const newId = generateId();
        sessionStorage.setItem('analytics_session_id', newId);
        sessionStorage.setItem('analytics_session_ts', now.toString());
        return newId;
    });

    const sessionIdRef = useRef(sessionId); // Keep ref for closures

    // Update timestamp on activity
    useEffect(() => {
        sessionStorage.setItem('analytics_session_ts', Date.now().toString());
    }, [location.pathname]);

    const startTimeRef = useRef(Date.now());
    const currentPathRef = useRef(location.pathname);

    // 1. Navigation Tracking
    useEffect(() => {
        // Don't track if no user (or track as anon if needed)
        if (!user) return;

        const now = Date.now();
        const duration = (now - startTimeRef.current) / 1000;
        const prevPath = currentPathRef.current;

        // Log PREVIOUS page view on exit
        if (prevPath && duration > 0.5) { // Filter instant redirects
            const view: PageView = {
                id: generateId(),
                userId: user.id,
                sessionId: sessionIdRef.current,
                path: prevPath,
                timestamp: new Date(startTimeRef.current).toISOString(),
                durationSeconds: parseFloat(duration.toFixed(1)),
                userAgent: navigator.userAgent
            };

            // Send to API (fire and forget)
            fetch('/api/usage/view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(view)
            }).catch(e => console.debug("Analytics view log failed", e));
        }

        // Reset for new page
        startTimeRef.current = now;
        currentPathRef.current = location.pathname;

    }, [location.pathname, user]);

    // 2. Global Click Tracking
    useEffect(() => {
        if (!user) return;

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Find closest interactive element
            const interactive = target.closest('button, a, input[type="submit"], [role="button"]');

            if (interactive) {
                const element = interactive as HTMLElement;
                let label = element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || '';

                // Truncate if too long
                if (label.length > 50) label = label.substring(0, 50) + '...';
                if (!label) return; // Skip if no meaningful label

                const event: InteractionEvent = {
                    id: generateId(),
                    userId: user.id,
                    sessionId: sessionIdRef.current,
                    type: 'click',
                    target: element.tagName.toLowerCase(),
                    label: label,
                    path: location.pathname,
                    timestamp: new Date().toISOString()
                };

                fetch('/api/usage/event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event)
                }).catch(e => console.debug("Analytics event log failed", e));
            }
        };

        window.addEventListener('click', handleClick, true); // Capture phase

        return () => {
            window.removeEventListener('click', handleClick, true);
        };
    }, [user, location.pathname]);

    // 3. Global Error Tracking
    useEffect(() => {
        if (!user) return;

        const handleError = (event: ErrorEvent) => {
            fetch('/api/usage/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: generateId(),
                    userId: user.id,
                    sessionId: sessionIdRef.current,
                    type: 'error',
                    target: 'window',
                    label: event.message,
                    path: location.pathname,
                    timestamp: new Date().toISOString(),
                    metadata: { stack: event.error?.stack, filename: event.filename, lineno: event.lineno }
                })
            }).catch(e => console.debug("Analytics error log failed", e));
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            fetch('/api/usage/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: generateId(),
                    userId: user.id,
                    sessionId: sessionIdRef.current,
                    type: 'error',
                    target: 'promise',
                    label: event.reason?.message || String(event.reason),
                    path: location.pathname,
                    timestamp: new Date().toISOString(),
                    metadata: { reason: event.reason }
                })
            }).catch(e => console.debug("Analytics rejection log failed", e));
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, [user, location.pathname]);

    const logEvent = (type: InteractionEvent['type'], label: string, target = 'custom', metadata?: any) => {
        if (!user) return;

        const event: InteractionEvent = {
            id: generateId(),
            userId: user.id,
            sessionId: sessionIdRef.current,
            type,
            target,
            label,
            path: location.pathname,
            timestamp: new Date().toISOString(),
            metadata
        };

        fetch('/api/usage/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        }).catch(e => console.debug("Analytics custom log failed", e));
    };

    return (
        <AnalyticsContext.Provider value={{ logEvent }}>
            {children}
        </AnalyticsContext.Provider>
    );
}

export function useAnalytics() {
    const context = useContext(AnalyticsContext);
    if (!context) {
        throw new Error('useAnalytics must be used within an AnalyticsProvider');
    }
    return context;
}
