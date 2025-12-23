import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { UniversalActivity } from '../models/types.ts';

/**
 * Hook to fetch Universal Activities from the backend API.
 */
export function useUniversalActivities(days = 90) {
    const { token } = useAuth();
    const [activities, setActivities] = useState<UniversalActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchActivities = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const end = new Date().toISOString().split('T')[0];
            const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const res = await fetch(`/api/activities?start=${start}&end=${end}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.activities) {
                setActivities(data.activities);
            } else {
                setActivities([]);
            }
        } catch (err) {
            console.error('Failed to fetch activities', err);
            setError('Failed to load activities');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivities();
    }, [token, days]);

    return { activities, loading, error, refetch: fetchActivities };
}
