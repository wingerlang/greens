const kv = await Deno.openKv();
const entries = kv.list({ prefix: ["analytics_page_view"] }, { limit: 100, reverse: true });
const paths = new Map<string, number>();

for await (const entry of entries) {
    const path = (entry.value as any).path;
    paths.set(path, (paths.get(path) || 0) + 1);
}

console.log(Object.fromEntries(paths));
Deno.exit(0);
