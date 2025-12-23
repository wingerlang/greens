
import { User, UserPrivacy, DEFAULT_PRIVACY } from '../models/types.ts';

// Mock DB for Social Features (until KV is fully implemented)
// In a real app, this would be Deno KV
export const MOCK_USERS: User[] = [
    {
        id: 'u_1',
        name: 'Johannes Winger-Lang',
        email: 'johannes@example.com',
        role: 'admin',
        plan: 'evergreen',
        settings: {} as any,
        handle: 'winger',
        bio: 'Runner, Coder, Coffee lover.',
        location: 'Stockholm, SE',
        followersCount: 124,
        followingCount: 45,
        privacy: { ...DEFAULT_PRIVACY, showWeight: true }, // Public profile
        createdAt: '2024-01-01'
    },
    {
        id: 'u_2',
        name: 'Anna Andersson',
        email: 'anna@example.com',
        role: 'user',
        plan: 'free',
        settings: {} as any,
        handle: 'anna_runs',
        bio: 'Marathon trainee. 🏃‍♀️',
        location: 'Gothenburg, SE',
        followersCount: 890,
        followingCount: 120,
        privacy: { ...DEFAULT_PRIVACY, isPublic: true },
        createdAt: '2024-02-01'
    },
    {
        id: 'u_3',
        name: 'Private User',
        email: 'private@example.com',
        role: 'user',
        plan: 'free',
        settings: {} as any,
        handle: 'ghost',
        bio: 'I am a mystery.',
        followersCount: 2,
        followingCount: 0,
        privacy: { ...DEFAULT_PRIVACY, isPublic: false },
        createdAt: '2024-03-01'
    }
];

export const MOCK_FOLLOWS: Record<string, string[]> = {
    'u_1': ['u_2'], // 'winger' follows 'anna_runs'
    'u_2': ['u_1'], // 'anna_runs' follows 'winger'
};

export async function getUserProfile(handle: string): Promise<User | null> {
    // Simulate API delay
    await new Promise(r => setTimeout(r, 400));
    return MOCK_USERS.find(u => u.handle === handle) || null;
}

export async function checkIsFollowing(followerId: string, targetId: string): Promise<boolean> {
    const list = MOCK_FOLLOWS[followerId] || [];
    return list.includes(targetId);
}

export async function toggleFollow(followerId: string, targetId: string): Promise<boolean> {
    await new Promise(r => setTimeout(r, 200));
    if (!MOCK_FOLLOWS[followerId]) MOCK_FOLLOWS[followerId] = [];

    const index = MOCK_FOLLOWS[followerId].indexOf(targetId);
    if (index >= 0) {
        MOCK_FOLLOWS[followerId].splice(index, 1);
        return false; // Unfollowed
    } else {
        MOCK_FOLLOWS[followerId].push(targetId);
        return true; // Followed
    }
}
