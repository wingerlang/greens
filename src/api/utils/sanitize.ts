/**
 * Simple utility to sanitize strings for safe HTML rendering/storage.
 * Prevents basic XSS by escaping <, >, &, ", and '.
 */
export function sanitizeString(str: string): string {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Recursively sanitizes strings within an object.
 */
export function sanitizeObject<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
        return sanitizeString(obj) as unknown as T;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip fields that shouldn't be sanitized (e.g., IDs, dates, hashes)
            if (['id', 'userId', 'externalId', 'date', 'createdAt', 'updatedAt', 'passHash', 'salt', 'token'].includes(key)) {
                sanitized[key] = value;
            } else {
                sanitized[key] = sanitizeObject(value);
            }
        }
        return sanitized as T;
    }

    return obj;
}
