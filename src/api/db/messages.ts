import { kv } from "../kv.ts";
import { Conversation, Message, ConversationType, SupportStatus } from "../../models/types.ts";

export async function createConversation(type: ConversationType, participants: string[], title?: string, initialProps: Partial<Conversation> = {}): Promise<Conversation> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conversation: Conversation = {
        id,
        type,
        participants,
        updatedAt: now,
        createdAt: now,
        title,
        ...initialProps
    };

    const atomic = kv.atomic();
    atomic.set(['conversations', id], conversation);

    // Index for each user
    for (const userId of participants) {
        atomic.set(['user_conversations', userId, id], id);
    }

    // If support, maybe index it differently too? For now, we rely on admins checking "unassigned" status or filtering conversations.
    // Ideally we might want a 'support_queue' index, but iterating all support convos is okay for now if volume is low.
    if (type === 'support') {
        atomic.set(['support_conversations', id], id);
    }

    const res = await atomic.commit();
    if (!res.ok) throw new Error("Failed to create conversation");
    return conversation;
}

export async function getConversation(id: string): Promise<Conversation | null> {
    const res = await kv.get<Conversation>(['conversations', id]);
    return res.value;
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
    const iter = kv.list({ prefix: ['user_conversations', userId] });
    const conversationIds: string[] = [];
    for await (const entry of iter) {
        conversationIds.push(entry.value as string);
    }

    // Fetch in parallel
    const conversations = await Promise.all(conversationIds.map(id => getConversation(id)));
    return conversations.filter((c): c is Conversation => c !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// Get all support conversations (for admins)
export async function getAllSupportConversations(): Promise<Conversation[]> {
    const iter = kv.list({ prefix: ['support_conversations'] });
    const conversationIds: string[] = [];
    for await (const entry of iter) {
        conversationIds.push(entry.value as string);
    }

    const conversations = await Promise.all(conversationIds.map(id => getConversation(id)));
    return conversations.filter((c): c is Conversation => c !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function addMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: 'text' | 'image' | 'system' | 'component' = 'text',
    options: { replyToId?: string; metadata?: Record<string, any> } = {}
): Promise<Message> {
    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    const message: Message = {
        id: messageId,
        conversationId,
        senderId,
        content,
        createdAt: now,
        readBy: [senderId],
        type,
        replyToId: options.replyToId,
        metadata: options.metadata
    };

    // Update conversation and add message atomically
    const conv = await getConversation(conversationId);
    if (!conv) throw new Error("Conversation not found");

    conv.updatedAt = now;
    conv.lastMessage = message;

    const res = await kv.atomic()
        .set(['messages', conversationId, now, messageId], message)
        .set(['conversations', conversationId], conv)
        .commit();

    if (!res.ok) throw new Error("Failed to add message");
    return message;
}

export async function getMessages(conversationId: string, limit: number = 50, cursor?: string): Promise<{ messages: Message[], cursor: string }> {
    const iter = kv.list<Message>({ prefix: ['messages', conversationId] }, { limit, cursor, reverse: true });
    const messages: Message[] = [];
    for await (const entry of iter) {
        messages.push(entry.value);
    }
    return { messages, cursor: iter.cursor };
}

export async function markRead(conversationId: string, userId: string): Promise<void> {
    const conv = await getConversation(conversationId);
    if (!conv || !conv.lastMessage) return;

    if (conv.lastMessage.readBy && conv.lastMessage.readBy.includes(userId)) return;

    // Update last message in conversation
    const readBy = conv.lastMessage.readBy || [];
    conv.lastMessage.readBy = [...readBy, userId];

    await kv.set(['conversations', conversationId], conv);
}

export async function getSupportConversation(userId: string): Promise<Conversation | null> {
    const conversations = await getUserConversations(userId);
    return conversations.find(c => c.type === 'support') || null;
}

export async function getDirectConversation(userId1: string, userId2: string): Promise<Conversation | null> {
    const conversations = await getUserConversations(userId1);
    return conversations.find(c =>
        c.type === 'direct' &&
        c.participants.includes(userId1) &&
        c.participants.includes(userId2) &&
        c.participants.length === 2
    ) || null;
}

// ==========================================
// New Feature Helpers
// ==========================================

export async function assignSupport(conversationId: string, adminId: string): Promise<Conversation> {
    const conv = await getConversation(conversationId);
    if (!conv) throw new Error("Conversation not found");
    if (conv.type !== 'support') throw new Error("Not a support conversation");

    conv.supportStatus = 'assigned';
    conv.assignedTo = adminId;

    // Ensure admin is a participant
    if (!conv.participants.includes(adminId)) {
        conv.participants.push(adminId);
    }

    const atomic = kv.atomic();
    atomic.set(['conversations', conversationId], conv);
    atomic.set(['user_conversations', adminId, conversationId], conversationId); // Add to admin's list

    const res = await atomic.commit();
    if (!res.ok) throw new Error("Failed to assign support");
    return conv;
}

export async function toggleLock(conversationId: string, isLocked: boolean): Promise<Conversation> {
    const conv = await getConversation(conversationId);
    if (!conv) throw new Error("Conversation not found");

    conv.isLocked = isLocked;

    const res = await kv.set(['conversations', conversationId], conv);
    if (!res.ok) throw new Error("Failed to update lock status");
    return conv;
}

export async function toggleHide(conversationId: string, isHidden: boolean): Promise<Conversation> {
    const conv = await getConversation(conversationId);
    if (!conv) throw new Error("Conversation not found");

    conv.isHidden = isHidden;

    const res = await kv.set(['conversations', conversationId], conv);
    if (!res.ok) throw new Error("Failed to update hide status");
    return conv;
}

export async function addReaction(conversationId: string, messageId: string, userId: string, emoji: string): Promise<Message> {
    // We need to find the message key. Since we store by [id, date, msgId], this is tricky if we don't have the date.
    // However, usually we can pass the timestamp or iterate to find it.
    // OPTIMIZATION: In a real app we'd have a lookup table or just require the client to send the timestamp.
    // For now, let's assume we have to search for it (inefficient but works for small scale) or changing the API to require timestamp?
    // Let's iterate. limit 100 recent messages.

    // Actually, `getMessages` returns messages. We can use that.
    const { messages } = await getMessages(conversationId, 100);
    const message = messages.find(m => m.id === messageId);

    if (!message) throw new Error("Message not found (or too old)");

    if (!message.reactions) message.reactions = {};
    if (!message.reactions[emoji]) message.reactions[emoji] = [];

    // Toggle logic: if already there, remove it
    const idx = message.reactions[emoji].indexOf(userId);
    if (idx >= 0) {
        message.reactions[emoji].splice(idx, 1);
        if (message.reactions[emoji].length === 0) {
            delete message.reactions[emoji];
        }
    } else {
        message.reactions[emoji].push(userId);
    }

    // Save back. We need the exact key which includes createdAt.
    await kv.set(['messages', conversationId, message.createdAt, messageId], message);
    return message;
}
