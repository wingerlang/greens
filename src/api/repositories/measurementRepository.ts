import { kv } from "../kv.ts";
import { BodyMeasurementEntry } from "../../models/types.ts";

export class MeasurementRepository {
  async saveMeasurement(
    userId: string,
    entry: BodyMeasurementEntry,
  ): Promise<void> {
    await kv.set(
      ["measurements", userId, entry.type, entry.date, entry.id],
      entry,
    );
  }

  async getMeasurementHistory(userId: string): Promise<BodyMeasurementEntry[]> {
    const iter = kv.list<BodyMeasurementEntry>({
      prefix: ["measurements", userId],
    });
    const history: BodyMeasurementEntry[] = [];
    for await (const entry of iter) {
      history.push(entry.value);
    }
    // sort by date descending
    return history.sort((a, b) => b.date.localeCompare(a.date));
  }

  async deleteMeasurement(
    userId: string,
    type: string,
    date: string,
    id: string,
  ): Promise<void> {
    await kv.delete(["measurements", userId, type, date, id]);
  }
}

export const measurementRepo = new MeasurementRepository();
