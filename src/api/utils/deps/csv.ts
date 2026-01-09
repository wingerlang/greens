
import { parse as parseCsv } from "csv-parse/sync";

export async function parse(input: string, options: any = {}): Promise<any[]> {
    if (globalThis.Deno) {
        // Dynamic import for Deno
        try {
            const { parse } = await import("https://jsr.io/@std/csv/1.0.6/mod.ts");
            return parse(input, options);
        } catch (e) {
            console.error("Failed to load Deno csv parser:", e);
            throw e;
        }
    } else {
        // Node.js Implementation using csv-parse
        // Map Deno options to csv-parse options if needed
        const csvOptions: any = {
            columns: options.columns,
            skip_empty_lines: true,
            from_line: options.skipFirstRow ? 2 : 1
        };
        return parseCsv(input, csvOptions);
    }
}
