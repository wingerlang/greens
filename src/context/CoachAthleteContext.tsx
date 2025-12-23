import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CoachAthleteRelation, Comment, Notification, SharedPlan, generateId } from '../models/types.ts';

// ============================================
// Types
// ============================================

type UserMode = 'solo' | 'coach' | 'athlete';

interface CoachAthleteState {
    mode: UserMode;
    currentUserId: string;
    relations: CoachAthleteRelation[];
    comments: Comment[];
    notifications: Notification[];
    sharedPlans: SharedPlan[];
}

interface CoachAthleteContextType extends CoachAthleteState {
    // Mode
    setMode: (mode: UserMode) => void;

    // Relations
    inviteAthlete: (email: string, name: string) => Promise<CoachAthleteRelation>;
    acceptInvitation: (relationId: string) => void;
    declineInvitation: (relationId: string) => void;
    removeAthlete: (relationId: string) => void;
    getMyAthletes: () => CoachAthleteRelation[];
    getMyCoach: () => CoachAthleteRelation | undefined;

    // Comments
    addComment: (targetType: Comment['targetType'], targetId: string, content: string) => Comment;
    replyToComment: (parentId: string, content: string) => Comment;
    deleteComment: (commentId: string) => void;
    getCommentsFor: (targetType: Comment['targetType'], targetId: string) => Comment[];

    // Notifications
    markAsRead: (notificationId: string) => void;
    markAllAsRead: () => void;
    getUnreadCount: () => number;
    addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;

    // Plan Sharing
    sharePlan: (planId: string, athleteIds: string[]) => SharedPlan;
    unsharePlan: (sharedPlanId: string) => void;
    getSharedPlansForMe: () => SharedPlan[];
}

const CoachAthleteContext = createContext<CoachAthleteContextType | null>(null);

// ============================================
// Provider
// ============================================

interface CoachAthleteProviderProps {
    children: ReactNode;
    userId: string;
    userName: string;
}

export function CoachAthleteProvider({ children, userId, userName }: CoachAthleteProviderProps) {
    const [mode, setMode] = useState<UserMode>('solo');
    const [relations, setRelations] = useState<CoachAthleteRelation[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [sharedPlans, setSharedPlans] = useState<SharedPlan[]>([]);

    // --- Relations ---
    const inviteAthlete = useCallback(async (email: string, name: string): Promise<CoachAthleteRelation> => {
        const relation: CoachAthleteRelation = {
            id: generateId(),
            coachId: userId,
            athleteId: email, // In real app, would resolve email to userId
            coachName: userName,
            athleteName: name,
            status: 'pending',
            sharedPlanIds: [],
            permissions: {
                canViewPlan: true,
                canEditPlan: false,
                canViewProgress: true,
                canComment: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setRelations(prev => [...prev, relation]);
        return relation;
    }, [userId, userName]);

    const acceptInvitation = useCallback((relationId: string) => {
        setRelations(prev => prev.map(r =>
            r.id === relationId ? { ...r, status: 'active', updatedAt: new Date().toISOString() } : r
        ));
    }, []);

    const declineInvitation = useCallback((relationId: string) => {
        setRelations(prev => prev.map(r =>
            r.id === relationId ? { ...r, status: 'declined', updatedAt: new Date().toISOString() } : r
        ));
    }, []);

    const removeAthlete = useCallback((relationId: string) => {
        setRelations(prev => prev.map(r =>
            r.id === relationId ? { ...r, status: 'removed', updatedAt: new Date().toISOString() } : r
        ));
    }, []);

    const getMyAthletes = useCallback(() => {
        return relations.filter(r => r.coachId === userId && r.status === 'active');
    }, [relations, userId]);

    const getMyCoach = useCallback(() => {
        return relations.find(r => r.athleteId === userId && r.status === 'active');
    }, [relations, userId]);

    // --- Comments ---
    const addComment = useCallback((targetType: Comment['targetType'], targetId: string, content: string): Comment => {
        const comment: Comment = {
            id: generateId(),
            targetType,
            targetId,
            authorId: userId,
            authorName: userName,
            authorRole: mode === 'coach' ? 'coach' : 'athlete',
            content,
            createdAt: new Date().toISOString()
        };
        setComments(prev => [...prev, comment]);
        return comment;
    }, [userId, userName, mode]);

    const replyToComment = useCallback((parentId: string, content: string): Comment => {
        const parent = comments.find(c => c.id === parentId);
        if (!parent) throw new Error('Parent comment not found');

        const reply: Comment = {
            id: generateId(),
            parentId,
            targetType: parent.targetType,
            targetId: parent.targetId,
            authorId: userId,
            authorName: userName,
            authorRole: mode === 'coach' ? 'coach' : 'athlete',
            content,
            createdAt: new Date().toISOString()
        };
        setComments(prev => [...prev, reply]);
        return reply;
    }, [comments, userId, userName, mode]);

    const deleteComment = useCallback((commentId: string) => {
        setComments(prev => prev.filter(c => c.id !== commentId));
    }, []);

    const getCommentsFor = useCallback((targetType: Comment['targetType'], targetId: string): Comment[] => {
        return comments.filter(c => c.targetType === targetType && c.targetId === targetId);
    }, [comments]);

    // --- Notifications ---
    const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
        const full: Notification = {
            ...notification,
            id: generateId(),
            isRead: false,
            createdAt: new Date().toISOString()
        };
        setNotifications(prev => [full, ...prev]);
    }, []);

    const markAsRead = useCallback((notificationId: string) => {
        setNotifications(prev => prev.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
        ));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }, []);

    const getUnreadCount = useCallback(() => {
        return notifications.filter(n => !n.isRead).length;
    }, [notifications]);

    // --- Plan Sharing ---
    const sharePlan = useCallback((planId: string, athleteIds: string[]): SharedPlan => {
        const shared: SharedPlan = {
            id: generateId(),
            planOwnerId: userId,
            sharedWithIds: athleteIds,
            visibility: 'shared',
            allowComments: true,
            allowForks: false,
            createdAt: new Date().toISOString()
        };
        setSharedPlans(prev => [...prev, shared]);

        // Notify athletes
        athleteIds.forEach(aId => {
            addNotification({
                userId: aId,
                type: 'plan_shared',
                title: 'Ny plan delad',
                message: `${userName} har delat en träningsplan med dig.`,
                relatedId: shared.id,
                relatedType: 'plan'
            });
        });

        return shared;
    }, [userId, userName, addNotification]);

    const unsharePlan = useCallback((sharedPlanId: string) => {
        setSharedPlans(prev => prev.filter(p => p.id !== sharedPlanId));
    }, []);

    const getSharedPlansForMe = useCallback(() => {
        return sharedPlans.filter(p => p.sharedWithIds.includes(userId));
    }, [sharedPlans, userId]);

    const value: CoachAthleteContextType = {
        mode,
        currentUserId: userId,
        relations,
        comments,
        notifications,
        sharedPlans,
        setMode,
        inviteAthlete,
        acceptInvitation,
        declineInvitation,
        removeAthlete,
        getMyAthletes,
        getMyCoach,
        addComment,
        replyToComment,
        deleteComment,
        getCommentsFor,
        markAsRead,
        markAllAsRead,
        getUnreadCount,
        addNotification,
        sharePlan,
        unsharePlan,
        getSharedPlansForMe
    };

    return (
        <CoachAthleteContext.Provider value={value}>
            {children}
        </CoachAthleteContext.Provider>
    );
}

// ============================================
// Hook
// ============================================

export function useCoachAthlete(): CoachAthleteContextType {
    const context = useContext(CoachAthleteContext);
    if (!context) {
        throw new Error('useCoachAthlete must be used within a CoachAthleteProvider');
    }
    return context;
}
