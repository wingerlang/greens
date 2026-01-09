/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
import { addDebugLog, getDebugContext } from "./utils/debugContext.ts";

/**
 * Shared Deno KV instance
 * Singleton pattern for database connection
 * Wrapped to intercept operations for debugging
 */

// @ts-ignore: Deno is polyfilled
const baseKv = await (globalThis.Deno ? Deno.openKv("./greens.db") : (globalThis as any).Deno.openKv("./greens.db"));

// Proxy handler to intercept KV operations
// @ts-ignore: Deno is polyfilled
const kvHandler: ProxyHandler<Deno.Kv> = {
    get(target, prop, receiver) {
        const original = Reflect.get(target, prop, receiver);

        if (typeof original === 'function') {
            // Intercept methods
            // @ts-ignore: Proxy typing is tricky
            return function (this: any, ...args: any[]) {
                const context = getDebugContext();
                if (!context) {
                    return original.apply(target, args);
                }

                // If it's an atomic operation, we need to wrap that too
                if (prop === 'atomic') {
                    const atomicOp = original.apply(target, args) as Deno.AtomicOperation;
                    return createAtomicProxy(atomicOp);
                }

                const start = performance.now();
                const promise = original.apply(target, args);

                if (promise instanceof Promise) {
                    return promise.then((result: any) => {
                        const duration = performance.now() - start;
                        addDebugLog({
                            type: 'kv',
                            operation: String(prop),
                            key: args[0] ? JSON.stringify(args[0]) : undefined,
                            duration,
                            timestamp: Date.now(),
                            details: prop === 'list' ? { count: 'stream' } : undefined // simplified
                        });
                        return result;
                    }).catch((err: any) => {
                        const duration = performance.now() - start;
                        addDebugLog({
                            type: 'kv',
                            operation: String(prop),
                            key: args[0] ? JSON.stringify(args[0]) : undefined,
                            duration,
                            timestamp: Date.now(),
                            error: String(err)
                        });
                        throw err;
                    });
                }

                return promise;
            };
        }

        return original;
    }
};

function createAtomicProxy(atomic: Deno.AtomicOperation): Deno.AtomicOperation {
    const context = getDebugContext();
    if (!context) return atomic;

    const atomicHandler: ProxyHandler<Deno.AtomicOperation> = {
        get(target, prop, receiver) {
            const original = Reflect.get(target, prop, receiver);
            if (typeof original === 'function') {
                // @ts-ignore: Proxy typing is tricky
                return function (this: any, ...args: any[]) {
                    if (prop === 'commit') {
                        const start = performance.now();
                        const promise = original.apply(target, args);
                        return promise.then((result: any) => {
                            const duration = performance.now() - start;
                            addDebugLog({
                                type: 'kv',
                                operation: 'atomic.commit',
                                duration,
                                timestamp: Date.now(),
                                details: { ok: result.ok }
                            });
                            return result;
                        });
                    }
                    // Track operations in the atomic chain if needed?
                    // For now just tracking the commit is most important for performance
                    // but we could track 'set', 'delete' inside atomic to see what happened.
                    if (['set', 'delete', 'check', 'sum', 'min', 'max'].includes(String(prop))) {
                        addDebugLog({
                            type: 'kv',
                            operation: `atomic.${String(prop)}`,
                            key: args[0] ? JSON.stringify(args[0]) : undefined,
                            duration: 0, // sync setup
                            timestamp: Date.now()
                        });
                    }
                    return original.apply(target, args);
                }
            }
            return original;
        }
    }
    return new Proxy(atomic, atomicHandler);
}

export const kv = new Proxy(baseKv, kvHandler);

export async function closeKv() {
    await baseKv.close();
}
