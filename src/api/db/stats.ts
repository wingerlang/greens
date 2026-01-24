import { kv } from "../kv.ts";

export interface LoginStat {
  userId: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  success: boolean;
}

export async function logLoginAttempt(
  userId: string,
  success: boolean,
  ip: string,
  userAgent: string,
) {
  const timestamp = new Date().toISOString();
  const stat: LoginStat = { userId, timestamp, ip, userAgent, success };
  await kv.set(["stats", "logins", userId, timestamp], stat);
  await kv.set(["stats", "all_logins", timestamp], stat);
}

export async function getUserLoginStats(userId: string) {
  const iter = kv.list({ prefix: ["stats", "logins", userId] }, {
    limit: 50,
    reverse: true,
  });
  const stats: LoginStat[] = [];
  for await (const entry of iter) {
    stats.push(entry.value as LoginStat);
  }
  return stats;
}
