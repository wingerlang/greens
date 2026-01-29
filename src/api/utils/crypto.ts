import { encodeBase64 } from "./deps/encoding.ts";

const ITERATIONS_V1 = 100000;
const ITERATIONS_V2 = 600000; // OWASP recommended for PBKDF2-HMAC-SHA256
export const CURRENT_ITERATIONS = ITERATIONS_V2;

/**
 * Common password hashing utility using PBKDF2.
 */
export async function hashPassword(password: string, salt: string, iterations: number = CURRENT_ITERATIONS): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: iterations,
            hash: 'SHA-256'
        },
        key,
        256
    );

    return encodeBase64(bits);
}

export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<{ isValid: boolean; needsUpgrade: boolean }> {
    // 1. Try V2 (Current Standard)
    const hashV2 = await hashPassword(password, salt, ITERATIONS_V2);
    if (hashV2 === storedHash) {
        return { isValid: true, needsUpgrade: false };
    }

    // 2. Try V1 (Legacy)
    const hashV1 = await hashPassword(password, salt, ITERATIONS_V1);
    if (hashV1 === storedHash) {
        return { isValid: true, needsUpgrade: true };
    }

    return { isValid: false, needsUpgrade: false };
}

export async function simulatePasswordCheck(): Promise<void> {
    // Simulate the time taken for a full check (failed V2 + failed V1)
    const dummy = "dummy";
    await hashPassword(dummy, dummy, ITERATIONS_V2);
    await hashPassword(dummy, dummy, ITERATIONS_V1);
}
