import { kv } from "../kv.ts";
import { Conversation, Message, ConversationType } from "../../models/types.ts";

export async function createConversation(type: ConversationType, participants: string[], title?: string): Promise<Conversation> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conversation: Conversation = {
        id,
        type,
        participants,
        updatedAt: now,
        createdAt: now,
        title
    };

    const atomic = kv.atomic();
    atomic.set(['conversations', id], conversation);

    // Index for each user
    for (const userId of participants) {
        atomic.set(['user_conversations', userId, id], id);
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

export async function addMessage(conversationId: string, senderId: string, content: string, type: 'text' | 'image' | 'system' = 'text'): Promise<Message> {
    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    const message: Message = {
        id: messageId,
        conversationId,
        senderId,
        content,
        createdAt: now,
        readBy: [senderId],
        type
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
    return;
}

export async function getSupportConversation(userId: string): Promise<Conversation | null> {
    const conversations = await getUserConversations(userId);
    return conversations.find(c => c.type === 'support') || null;
}
