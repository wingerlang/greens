export function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_, val) => {
    if (typeof val === "bigint") {
      return val.toString();
    }
    return val;
  });
}
