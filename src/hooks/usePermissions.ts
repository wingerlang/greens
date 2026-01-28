import { useData } from '../context/DataContext.tsx';
import { FeatureKey, PermissionConfig, DEFAULT_PERMISSION_CONFIG, SubscriptionTier } from '../models/types.ts';

export function usePermissions() {
    const { currentUser, permissionConfig } = useData();

    // Default to 'free' if no user or no subscription (should not happen for logged in)
    // Note: currentUser might be null during loading, so we handle that safely.
    // Also handling legacy 'plan' field if subscription is missing (though migration should handle it)
    const tier: SubscriptionTier =
        currentUser?.subscription?.tier ||
        (currentUser?.plan as SubscriptionTier) ||
        'free';

    // Fallback to default config if context is not loaded yet or offline without cache
    const config = permissionConfig || DEFAULT_PERMISSION_CONFIG;

    function hasPermission(feature: FeatureKey): boolean {
        const limit = getLimit(feature);
        if (typeof limit === 'boolean') return limit;
        if (typeof limit === 'number') return limit > 0;
        return false;
    }

    function getLimit(feature: FeatureKey): number | boolean {
        const tierConfig = config[tier];
        if (!tierConfig) return false;
        return tierConfig[feature] ?? false;
    }

    /**
     * Checks if usage exceeds limit.
     * @param feature
     * @param currentUsage
     * @returns true if allowed (under limit), false if blocked (at or over limit)
     */
    function checkUsage(feature: FeatureKey, currentUsage: number): boolean {
        const limit = getLimit(feature);
        if (limit === true) return true; // Unlimited boolean
        if (limit === false) return false; // Blocked boolean
        if (typeof limit === 'number') {
            // If limit is 9999, treat as unlimited effectively
            if (limit >= 9999) return true;
            return currentUsage < limit;
        }
        return false;
    }

    return {
        tier,
        config,
        hasPermission,
        getLimit,
        checkUsage,
        isEvergreen: tier === 'evergreen'
    };
}
