// Profile API Service - Frontend client for profile endpoints

const API_BASE = 'http://localhost:8000/api';

function getHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

export interface ProfileData {
    name?: string;
    bio?: string;
    location?: string;
    handle?: string;
    birthdate?: string;
    avatarUrl?: string;
    website?: string;
    phone?: string;
    streak?: number;
    privacy?: {
        isPublic?: boolean;
        allowFollowers?: boolean;
        showWeight?: boolean;
        showAge?: boolean;
        showCalories?: boolean;
        showDetailedTraining?: boolean;
        showSleep?: boolean;
    };
}

export const profileService = {

    /**
     * Fetch full profile for current user
     */
    async getProfile(): Promise<ProfileData | null> {
        const res = await fetch(`${API_BASE}/user/profile`, {
            headers: getHeaders()
        });
        if (!res.ok) return null;
        return res.json();
    },

    /**
     * Update profile fields
     */
    async updateProfile(updates: Partial<ProfileData>): Promise<ProfileData | null> {
        const res = await fetch(`${API_BASE}/user/profile`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) return null;
        return res.json();
    },

    /**
     * Check if a handle is available
     */
    async checkHandle(handle: string): Promise<{ available: boolean, reason?: string }> {
        if (!handle || handle.length < 3) {
            return { available: false, reason: 'Too short' };
        }
        const res = await fetch(`${API_BASE}/user/check-handle/${handle}`, {
            headers: getHeaders()
        });
        if (!res.ok) return { available: false, reason: 'Error' };
        return res.json();
    },

    /**
     * Update privacy settings
     */
    async updatePrivacy(updates: Partial<ProfileData['privacy']>): Promise<ProfileData['privacy'] | null> {
        const res = await fetch(`${API_BASE}/user/privacy`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.privacy;
    },

    /**
     * Get current streak
     */
    async getStreak(): Promise<number> {
        const res = await fetch(`${API_BASE}/user/streak`, {
            headers: getHeaders()
        });
        if (!res.ok) return 0;
        const data = await res.json();
        return data.streak || 0;
    },

    /**
     * Upload avatar (base64)
     */
    async uploadAvatar(base64Data: string): Promise<string | null> {
        const res = await fetch(`${API_BASE}/user/profile`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ avatarUrl: base64Data })
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.avatarUrl;
    }
};
