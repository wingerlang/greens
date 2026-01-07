
import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal';
import { mapUniversalToLegacyEntry } from '../utils/mappers';

export function ActivityStandalonePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { universalActivities } = useData();

    // Find the universal activity
    const activity = useMemo(() => {
        return universalActivities.find(a => a.id === id);
    }, [universalActivities, id]);

    // Map to legacy format for the modal
    const mappedActivity = useMemo(() => {
        if (!activity) return null;
        const legacy = mapUniversalToLegacyEntry(activity);
        if (!legacy) return null;
        // Ensure source property exists (mocking it if mapper doesn't provide it sufficiently for the intersection type)
        return { ...legacy, source: activity.source || 'universal' };
    }, [activity]);

    // If activity not found (or data loading), show loading or redirect
    useEffect(() => {
        // Only redirect if data is loaded (universalActivities has items) but item not found
        // If universalActivities is empty, it might be initial load.
        // But in real app, it might populate later.
        if (universalActivities.length > 0 && !activity) {
            navigate('/activities');
        }
    }, [universalActivities, activity, navigate]);

    if (!activity || !mappedActivity) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
                Laddar aktivitet...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4">
            <ActivityDetailModal
                activity={mappedActivity as any}
                universalActivity={activity}
                onClose={() => navigate(-1)}
            />
        </div>
    );
}
