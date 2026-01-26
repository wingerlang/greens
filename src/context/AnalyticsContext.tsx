import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import { PageView, InteractionEvent, generateId } from '../models/types.ts';
import { safeFetch } from '../utils/http.ts';

interface AnalyticsContextType {
    logEvent: (type: InteractionEvent['type'], label: string, target?: string, metadata?: any) => void;
    visitStats: {
        paths: Record<string, number>;
        users: Record<string, number>;
        omniboxNavs: Record<string, number>;
    };
    refreshStats: () => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const { user, token } = useAuth();
    const [visitStats, setVisitStats] = useState<{
        paths: Record<string, number>;
        users: Record<string, number>;
        omniboxNavs: Record<string, number>;
    }>({ paths: {}, users: {}, omniboxNavs: {} });

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
    const lastInteractionRef = useRef<{ time: number, target: string } | null>(null);

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

    // 2. Global Click Tracking (with Heatmap & Rage Click detection)
    const lastClickRef = useRef<{ target: string; time: number; count: number } | null>(null);

    useEffect(() => {
        if (!user) return;

        const handleMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            lastInteractionRef.current = { time: Date.now(), target: target.tagName };
        };

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // --- Heatmap Data Capture ---
            // Capture ALL clicks, not just interactive ones, for pure heatmap
            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;
            const x = e.clientX;
            const y = e.clientY;

            // --- Rage Click Logic ---
            // Check if clicking same element rapidly (within 500ms)
            // Use a simple selector path as "ID"
            const selector = target.id ? `#${target.id}` : target.tagName.toLowerCase() + (target.className ? `.${target.className.split(' ')[0]}` : '');
            const now = Date.now();

            if (lastClickRef.current &&
                lastClickRef.current.target === selector &&
                (now - lastClickRef.current.time < 500)) {

                lastClickRef.current.count++;
                lastClickRef.current.time = now;

                if (lastClickRef.current.count === 3) { // Trigger on 3rd rapid click
                    const rect = target.getBoundingClientRect();
                    const rageEvent: InteractionEvent = {
                        id: generateId(),
                        userId: user.id,
                        sessionId: sessionIdRef.current,
                        type: 'rage_click',
                        target: selector,
                        label: 'Rage Click Detected',
                        path: location.pathname,
                        timestamp: new Date().toISOString(),
                        coordinates: {
                            x, y,
                            pctX: Math.round((x / viewportW) * 100),
                            pctY: Math.round((y / viewportH) * 100),
                            viewportW,
                            viewportH
                        },
                        elementRect: {
                            top: Math.round(rect.top),
                            left: Math.round(rect.left),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height)
                        }
                    };
                    fetch('/api/usage/event', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(rageEvent)
                    }).catch(e => console.debug("Analytics rage log failed", e));
                }
            } else {
                lastClickRef.current = { target: selector, time: now, count: 1 };
            }
            // ------------------------

            // Find closest interactive element
            const interactive = target.closest('button, a, input, select, textarea, [role="button"], [onclick]');

            if (interactive) {
                const element = interactive as HTMLElement;
                let label = element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || '';

                // Truncate if too long
                if (label.length > 50) label = label.substring(0, 50) + '...';
                if (!label) return; // Skip if no meaningful label

                const rect = element.getBoundingClientRect();

                // PERFORMANCE: Calculate duration from mousedown
                let interactionDuration = 0;
                if (lastInteractionRef.current) {
                    interactionDuration = Date.now() - lastInteractionRef.current.time;
                    lastInteractionRef.current = null;
                }

                const event: InteractionEvent = {
                    id: generateId(),
                    userId: user.id,
                    sessionId: sessionIdRef.current,
                    type: 'click',
                    target: element.tagName.toLowerCase(),
                    label: label,
                    path: location.pathname,
                    timestamp: new Date().toISOString(),
                    metadata: { interactionDuration },
                    coordinates: {
                        x, y,
                        pctX: Math.round((x / viewportW) * 100),
                        pctY: Math.round((y / viewportH) * 100),
                        viewportW,
                        viewportH
                    },
                    elementRect: {
                        top: Math.round(rect.top),
                        left: Math.round(rect.left),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    }
                };

                fetch('/api/usage/event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event)
                }).catch(e => console.debug("Analytics event log failed", e));
            } else {
                // --- Dead Click Logic ---
                // If not interactive, and it's text/div/span, user might be confused
                const rect = target.getBoundingClientRect();
                const isText = ['P', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(target.tagName);
                if (isText && target.innerText && target.innerText.length < 50) { // Limit to short texts that look like buttons
                    const deadEvent: InteractionEvent = {
                        id: generateId(),
                        userId: user.id,
                        sessionId: sessionIdRef.current,
                        type: 'dead_click',
                        target: target.tagName,
                        label: target.innerText.substring(0, 30),
                        path: location.pathname,
                        timestamp: new Date().toISOString(),
                        coordinates: {
                            x, y,
                            pctX: Math.round((x / viewportW) * 100),
                            pctY: Math.round((y / viewportH) * 100),
                            viewportW,
                            viewportH
                        },
                        elementRect: {
                            top: Math.round(rect.top),
                            left: Math.round(rect.left),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height)
                        }
                    };
                    fetch('/api/usage/event', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(deadEvent)
                    }).catch(e => console.debug("Analytics dead log failed", e));
                }
            }
        };

        const handleCopy = (e: ClipboardEvent) => {
            const selection = window.getSelection()?.toString();
            if (!selection || selection.length < 2) return;

            const target = e.target as HTMLElement;
            const container = target.closest('div, p, pre, code, span') as HTMLElement;
            const label = container ? (container.innerText.substring(0, 30) + '...') : 'Selection';

            const copyEvent: InteractionEvent = {
                id: generateId(),
                userId: user.id,
                sessionId: sessionIdRef.current,
                type: 'copy',
                target: target.tagName.toLowerCase(),
                label: label,
                path: location.pathname,
                timestamp: new Date().toISOString(),
                metadata: {
                    textLength: selection.length,
                    textSnippet: selection.substring(0, 100),
                    container: container?.tagName.toLowerCase()
                }
            };

            fetch('/api/usage/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(copyEvent)
            }).catch(e => console.debug("Analytics copy log failed", e));
        };

        window.addEventListener('mousedown', handleMouseDown, true);
        window.addEventListener('click', handleClick, true); // Capture phase
        window.addEventListener('copy', handleCopy as EventListener, true);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown, true);
            window.removeEventListener('click', handleClick, true);
            window.removeEventListener('copy', handleCopy as EventListener, true);
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

    const refreshStats = async () => {
        if (!token) return;
        try {
            const [statsData, usersData, omniboxData] = await Promise.all([
                safeFetch<any>('/api/usage/stats?days=30', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                safeFetch<any>('/api/usage/users?days=30', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                safeFetch<any>('/api/usage/omnibox?days=30', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const paths: Record<string, number> = {};
            const users: Record<string, number> = {};
            const omniboxNavs: Record<string, number> = {};

            if (statsData?.popularPages) {
                statsData.popularPages.forEach((p: any) => {
                    paths[p.path] = p.count;
                });
            }

            if (usersData?.users) {
                usersData.users.forEach((u: any) => {
                    users[u.userId] = u.pageViews;
                });
            }

            if (omniboxData?.topNavigations) {
                omniboxData.topNavigations.forEach((n: any) => {
                    omniboxNavs[n.path] = n.count;
                });
            }

            setVisitStats({ paths, users, omniboxNavs });
        } catch (e) {
            console.error("Failed to refresh visit stats", e);
        }
    };

    // Auto-refresh stats when token becomes available or every 10 mins
    useEffect(() => {
        if (token) {
            refreshStats();
        }
    }, [token]);

    return (
        <AnalyticsContext.Provider value={{ logEvent, visitStats, refreshStats }}>
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
