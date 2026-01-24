import { kv } from "../kv.ts";
import { PerformanceGoal } from "../../models/types.ts";

export const goalRepo = {
  async getGoals(userId: string): Promise<PerformanceGoal[]> {
    const iter = kv.list<PerformanceGoal>({ prefix: ["goals", userId] });
    const goals: PerformanceGoal[] = [];
    for await (const res of iter) {
      goals.push(res.value);
    }
    return goals;
  },

  async saveGoal(userId: string, goal: PerformanceGoal): Promise<void> {
    await kv.set(["goals", userId, goal.id], goal);
  },

  async deleteGoal(userId: string, goalId: string): Promise<void> {
    await kv.delete(["goals", userId, goalId]);
  },
};
