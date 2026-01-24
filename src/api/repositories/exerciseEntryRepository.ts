import { kv } from "../kv.ts";
import { ExerciseEntry } from "../../models/types.ts";

export class ExerciseEntryRepository {
  // Key structure: ['exercise_entries', userId, date, id]
  // Allowing range queries by date.

  async saveEntry(userId: string, entry: ExerciseEntry): Promise<void> {
    // Ensure we have a date and ID
    if (!entry.date || !entry.id) {
      throw new Error("Entry must have date and id");
    }
    await kv.set(["exercise_entries", userId, entry.date, entry.id], entry);
  }

  async getEntriesByDate(
    userId: string,
    date: string,
  ): Promise<ExerciseEntry[]> {
    const iter = kv.list<ExerciseEntry>({
      prefix: ["exercise_entries", userId, date],
    });
    const entries: ExerciseEntry[] = [];
    for await (const row of iter) {
      entries.push(row.value);
    }
    return entries;
  }

  async getEntriesInRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<ExerciseEntry[]> {
    const iter = kv.list<ExerciseEntry>({
      start: ["exercise_entries", userId, startDate],
      end: ["exercise_entries", userId, endDate + "\uffff"],
    });
    const entries: ExerciseEntry[] = [];
    for await (const row of iter) {
      entries.push(row.value);
    }
    return entries;
  }

  async deleteEntry(userId: string, date: string, id: string): Promise<void> {
    await kv.delete(["exercise_entries", userId, date, id]);
  }
}

export const exerciseEntryRepo = new ExerciseEntryRepository();
