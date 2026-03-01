
import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal';
import { mapUniversalToLegacyEntry } from '../utils/mappers';

export function ActivityStandalonePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { unifiedActivities } = useData();

    // Find the unified activity
    const activity = useMemo(() => {
        return (unifiedActivities as any[]).find(a => a.id === id);
    }, [unifiedActivities, id]);

    // Map to legacy format for the modal
    const mappedActivity = useMemo(() => {
        if (!activity) return null;

        // If it's already a legacy-style activity (manual/merged/strava from unifiedActivities), return it
        // The unifiedActivities array already contains objects that mimic ExerciseEntry
        // so we don't always need to map through mapUniversalToLegacyEntry if performance is missing
        if (activity.source === 'manual' || activity.source === 'merged' || activity.source === 'strength' || activity.source === 'strava' || !activity.performance) {
            return activity;
        }

        const legacy = mapUniversalToLegacyEntry(activity);
        if (!legacy) return activity; // Fallback to raw activity if mapping fails
        // Ensure source property exists
        return { ...legacy, source: activity.source || 'universal' };
    }, [activity]);

    // If activity not found (or data loading), show loading or redirect
    useEffect(() => {
        if (unifiedActivities.length > 0 && !activity) {
            navigate('/activities');
        }
    }, [unifiedActivities, activity, navigate]);

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

export default ActivityStandalonePage;
