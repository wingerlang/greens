
export function encodeBase64(input: string | Uint8Array | ArrayBuffer | SharedArrayBuffer): string {
    if (globalThis.Deno && !(globalThis as any).IS_NODE_COMPAT_MODE) {
        // We can just use btoa for string, or implement a simple util.
        // But to match the Deno std/encoding/base64 signature which accepts buffers:
        if (typeof input === 'string') {
            return btoa(input);
        }

        // Convert buffer to binary string
        let binary = '';
        const bytes = new Uint8Array(input as any);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    } else {
        // Node.js
        if (typeof input === 'string') {
            return Buffer.from(input).toString('base64');
        }
        return Buffer.from(input as any).toString('base64');
    }
}
