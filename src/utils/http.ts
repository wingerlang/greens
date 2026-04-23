
export class NetworkError extends Error {
    constructor(public originalError: any) {
        super("Kunde inte nå servern. Kontrollera att servern är igång.");
        this.name = "NetworkError";
    }
}

export class ApiError extends Error {
    constructor(public status: number, public statusText: string, public body: any) {
        super(`API Error: ${status} ${statusText}`);
        this.name = "ApiError";
    }
}

/**
 * A wrapper around fetch that safely handles:
 * 1. Network errors (Server down) -> Throws NetworkError
 * 2. HTTP Errors (4xx, 5xx) -> Throws ApiError
 * 3. Empty responses (204 or Content-Length 0) -> Returns null
 * 4. Malformed JSON -> Throws Error
 */
export async function safeFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
    // Automatically inject auth token if available in localStorage
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const authHeaders: HeadersInit = {};
    if (token && token !== 'null' && token !== 'undefined' && token.length > 10) {
        authHeaders['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = {
        credentials: 'include',
        ...options,
        headers: {
            ...authHeaders,
            ...options?.headers
        }
    };

    let response: Response;
    try {
        response = await fetch(url, fetchOptions);
    } catch (error) {
        console.error(`[safeFetch] Network error for ${url}:`, error);
        throw new NetworkError(error);
    }

    if (!response.ok) {
        const text = await response.text();
        console.error(`[safeFetch] HTTP error ${response.status} for ${url}:`, text);
        throw new ApiError(response.status, response.statusText, text);
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) return null;

    try {
        return JSON.parse(text) as T;
    } catch (e) {
        console.error(`[safeFetch] JSON parse error for ${url}:`, text.substring(0, 500));
        // Check if it's the "Unexpected end of JSON input" scenario manually, though text check covers most.
        throw new Error(`Ogiltigt JSON-svar från servern: ${text.substring(0, 50)}...`);
    }
}
