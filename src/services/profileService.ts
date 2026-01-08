// Profile API Service - Frontend client for profile endpoints

const API_BASE = 'http://localhost:8000/api';

function getHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

export type VisibilityLevel = 'PUBLIC' | 'FRIENDS' | 'PRIVATE' | 'INDIVIDUAL';

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
    email?: string;
    maxHr?: number;
    restingHr?: number;
    lthr?: number;
    vdot?: number;
    ftp?: number;
    weight?: number;
    targetWeight?: number;
    weekStartsOn?: number;
    preferredUnits?: string;
    privacy?: {
        isPublic?: boolean;
        allowFollowers?: boolean;
        sharing?: {
            training?: VisibilityLevel;
            nutrition?: VisibilityLevel;
            health?: VisibilityLevel;
            social?: VisibilityLevel;
            body?: VisibilityLevel;
        };
        whitelistedUsers?: string[];
        showWeight?: boolean;
        showHeight?: boolean;
        showBirthYear?: boolean;
        showDetailedTraining?: boolean;
        categoryOverrides?: {
            [userId: string]: {
                training?: boolean;
                nutrition?: boolean;
                health?: boolean;
                social?: boolean;
                body?: boolean;
            };
        };
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
    },

    // ==========================================
    // Weight History
    // ==========================================

    async logWeight(weight: number, date?: string): Promise<boolean> {
        const res = await fetch(`${API_BASE}/user/weight`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ weight, date })
        });
        return res.ok;
    },

    async getWeightHistory(): Promise<{ weight: number, date: string }[]> {
        const res = await fetch(`${API_BASE}/user/weight`, {
            headers: getHeaders()
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.history || [];
    },

    // ==========================================
    // Personal Records
    // ==========================================

    async getPRs(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/user/prs`, {
            headers: getHeaders()
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.prs || [];
    },

    async detectPRs(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/user/prs/detect`, {
            headers: getHeaders()
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.detected || [];
    },

    async savePR(pr: { category: string, time: string, date?: string, activityId?: string, isManual?: boolean }): Promise<boolean> {
        const res = await fetch(`${API_BASE}/user/prs`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(pr)
        });
        return res.ok;
    },

    async deletePR(category: string): Promise<boolean> {
        const res = await fetch(`${API_BASE}/user/prs/${encodeURIComponent(category)}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return res.ok;
    },

    // ==========================================
    // Data Export
    // ==========================================

    async exportData(): Promise<any> {
        const res = await fetch(`${API_BASE}/user/export`, {
            headers: getHeaders()
        });
        if (!res.ok) return null;
        return res.json();
    },

    downloadExport(data: any) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `greens-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // ==========================================
    // HR Zones
    // ==========================================

    async detectHRZones(): Promise<any> {
        const res = await fetch(`${API_BASE}/user/hr-zones/detect`, {
            headers: getHeaders()
        });
        if (!res.ok) return null;
        return res.json();
    },

    async getHRZones(): Promise<any> {
        const res = await fetch(`${API_BASE}/user/hr-zones`, {
            headers: getHeaders()
        });
        if (!res.ok) return null;
        return res.json();
    },

    async saveHRZones(zones: any): Promise<boolean> {
        const res = await fetch(`${API_BASE}/user/hr-zones`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(zones)
        });
        return res.ok;
    },

    // ==========================================
    // Activity Statistics
    // ==========================================

    async getActivityStats(): Promise<any> {
        const res = await fetch(`${API_BASE}/user/stats`, {
            headers: getHeaders()
        });
        if (!res.ok) return null;
        return res.json();
    },

    // ==========================================
    // Notification Settings
    // ==========================================

    async getNotifications(): Promise<any> {
        const res = await fetch(`${API_BASE}/user/notifications`, {
            headers: getHeaders()
        });
        if (!res.ok) return null;
        return res.json();
    },

    async updateNotifications(settings: any): Promise<any> {
        const res = await fetch(`${API_BASE}/user/notifications`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        if (!res.ok) return null;
        return res.json();
    },

    // ==========================================
    // Session Management
    // ==========================================

    async getSessions(): Promise<any[]> {
        const res = await fetch(`${API_BASE}/user/sessions`, {
            headers: getHeaders()
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.sessions || [];
    },

    async revokeSession(sessionToken: string): Promise<boolean> {
        const res = await fetch(`${API_BASE}/user/sessions/${encodeURIComponent(sessionToken)}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return res.ok;
    },

    async revokeAllOtherSessions(): Promise<boolean> {
        const res = await fetch(`${API_BASE}/user/sessions`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return res.ok;
    },

    // ==========================================
    // Social Counts
    // ==========================================

    async getSocialCounts(): Promise<{ followers: number, following: number }> {
        const res = await fetch(`${API_BASE}/user/social-counts`, {
            headers: getHeaders()
        });
        if (!res.ok) return { followers: 0, following: 0 };
        return res.json();
    },

    // ==========================================
    // Danger Zone
    // ==========================================

    async resetData(type: 'meals' | 'exercises' | 'weight' | 'sleep' | 'water' | 'caffeine' | 'food' | 'all'): Promise<boolean> {
        const res = await fetch(`${API_BASE}/user/reset`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ type })
        });
        return res.ok;
    }
};

