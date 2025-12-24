import { User } from '../models/types.ts';

const API_BASE = 'http://localhost:8000/api';

async function getHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

export const socialService = {
    async getProfileByHandle(handle: string): Promise<User | null> {
        const res = await fetch(`${API_BASE}/u/${handle}`, {
            headers: await getHeaders()
        });
        if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error('Failed to fetch profile');
        }
        return res.json();
    },

    async followUser(targetId: string): Promise<void> {
        const res = await fetch(`${API_BASE}/social/follow/${targetId}`, {
            method: 'POST',
            headers: await getHeaders()
        });
        if (!res.ok) throw new Error('Failed to follow user');
    },

    async unfollowUser(targetId: string): Promise<void> {
        const res = await fetch(`${API_BASE}/social/unfollow/${targetId}`, {
            method: 'POST',
            headers: await getHeaders()
        });
        if (!res.ok) throw new Error('Failed to unfollow user');
    },

    async checkIsFollowing(followerId: string, targetId: string): Promise<boolean> {
        const res = await fetch(`${API_BASE}/social/is-following/${targetId}`, {
            headers: await getHeaders()
        });
        if (!res.ok) return false;
        const data = await res.json();
        return data.isFollowing;
    },

    async getCommunityUsers(): Promise<User[]> {
        const res = await fetch(`${API_BASE}/users`, {
            headers: await getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch community users');
        const data = await res.json();
        return data.users || [];
    },

    async getFollowing(): Promise<string[]> {
        const res = await fetch(`${API_BASE}/user/following`, {
            headers: await getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch following list');
        const data = await res.json();
        return data.followingIds || [];
    }
};
