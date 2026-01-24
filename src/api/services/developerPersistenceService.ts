/// <reference lib="deno.ns" />
import { ProjectStats } from "./codeAnalysisService.ts";

export interface RefactorTodo {
  id: string;
  description: string;
  file?: string;
  type: "duplicate" | "unused" | "comment" | "other";
  status: "active" | "fixed";
  createdAt: number;
  resolvedAt?: number;
}

export interface DeveloperSnapshot {
  timestamp: number;
  stats: ProjectStats;
}

export class DeveloperPersistenceService {
  private kv: Deno.Kv | null = null;

  private async getKv(): Promise<Deno.Kv> {
    if (!this.kv) {
      // Use global Deno.openKv if available, otherwise it might fail in Node without polyfill setup correctly in this context
      // Assuming Deno runtime or Polyfilled Node environment
      this.kv = await Deno.openKv();
    }
    return this.kv;
  }

  async saveSnapshot(stats: ProjectStats): Promise<void> {
    const kv = await this.getKv();
    const timestamp = Date.now();
    // Use a consistent key for daily snapshots? Or just keep all?
    // Let's keep all for now, maybe cleanup later.
    // Key: ['developer', 'snapshots', timestamp]

    // Check if we have a snapshot for today already to avoid spam
    const today = new Date().toISOString().split("T")[0];
    const iter = kv.list({ prefix: ["developer", "snapshots"] }, {
      reverse: true,
      limit: 1,
    });
    for await (const entry of iter) {
      const lastTs = entry.key[2] as number;
      const lastDate = new Date(lastTs).toISOString().split("T")[0];
      if (lastDate === today) {
        // Update today's snapshot instead of creating new
        await kv.set(["developer", "snapshots", lastTs], {
          timestamp: lastTs,
          stats,
        });
        return;
      }
    }

    await kv.set(["developer", "snapshots", timestamp], { timestamp, stats });
  }

  async getSnapshots(limit: number = 30): Promise<DeveloperSnapshot[]> {
    const kv = await this.getKv();
    const iter = kv.list<DeveloperSnapshot>({
      prefix: ["developer", "snapshots"],
    }, { reverse: true, limit });
    const snapshots: DeveloperSnapshot[] = [];
    for await (const entry of iter) {
      snapshots.push(entry.value);
    }
    return snapshots.sort((a, b) => a.timestamp - b.timestamp); // Return chronological for charts
  }

  async addTodo(
    todo: Omit<RefactorTodo, "id" | "createdAt" | "status">,
  ): Promise<RefactorTodo> {
    const kv = await this.getKv();
    const id = crypto.randomUUID();
    const newTodo: RefactorTodo = {
      ...todo,
      id,
      createdAt: Date.now(),
      status: "active",
    };
    await kv.set(["developer", "todos", id], newTodo);
    return newTodo;
  }

  async updateTodoStatus(
    id: string,
    status: "active" | "fixed",
  ): Promise<void> {
    const kv = await this.getKv();
    const entry = await kv.get<RefactorTodo>(["developer", "todos", id]);
    if (entry.value) {
      const updated = {
        ...entry.value,
        status,
        resolvedAt: status === "fixed" ? Date.now() : undefined,
      };
      await kv.set(["developer", "todos", id], updated);
    }
  }

  async deleteTodo(id: string): Promise<void> {
    const kv = await this.getKv();
    await kv.delete(["developer", "todos", id]);
  }

  async getTodos(): Promise<RefactorTodo[]> {
    const kv = await this.getKv();
    const iter = kv.list<RefactorTodo>({ prefix: ["developer", "todos"] });
    const todos: RefactorTodo[] = [];
    for await (const entry of iter) {
      todos.push(entry.value);
    }
    return todos.sort((a, b) => b.createdAt - a.createdAt);
  }
}
