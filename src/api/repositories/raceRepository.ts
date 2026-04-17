import { kv } from "../kv.ts";
import { RacePlan } from "../../models/types.ts";

export class RaceRepository {
    async saveRacePlan(userId: string, plan: RacePlan): Promise<void> {
        await kv.set(["race_plans", userId, plan.id], plan);
    }

    async getRacePlans(userId: string): Promise<RacePlan[]> {
        const iter = kv.list<RacePlan>({ prefix: ["race_plans", userId] });
        const plans: RacePlan[] = [];
        for await (const entry of iter) {
            plans.push(entry.value);
        }
        return plans;
    }
}

export const raceRepo = new RaceRepository();
