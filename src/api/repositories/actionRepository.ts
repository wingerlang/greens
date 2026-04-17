import { kv } from "../kv.ts";
import { DatabaseAction } from "../../models/types.ts";

export class ActionRepository {
    async saveAction(userId: string, action: DatabaseAction): Promise<void> {
        // Store by timestamp to allow range queries and chronological sorting
        await kv.set(["actions", userId, action.timestamp, action.id], action);
    }

    async getActions(userId: string, limit: number = 100): Promise<DatabaseAction[]> {
        const iter = kv.list<DatabaseAction>(
            { prefix: ["actions", userId] },
            { limit, reverse: true }
        );
        const actions: DatabaseAction[] = [];
        for await (const entry of iter) {
            actions.push(entry.value);
        }
        return actions;
    }
}

export const actionRepo = new ActionRepository();
