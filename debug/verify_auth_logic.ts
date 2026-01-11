import "../src/api/node-polyfill.ts";
import { hasRole, AuthContext } from "../src/api/middleware.ts";
import { UserRole, User } from "../src/models/types.ts";

function createMockContext(role: UserRole): AuthContext {
    return {
        user: {
            id: '123',
            username: 'test',
            role: role,
            // Mock other required fields
            name: 'Test',
            email: 'test@test.com',
            plan: 'free',
            settings: {} as any,
            createdAt: new Date().toISOString()
        } as User,
        token: 'abc'
    };
}

const developerCtx = createMockContext('developer');
const adminCtx = createMockContext('admin');
const userCtx = createMockContext('user');

// Test Developer Context
console.log("Checking Developer User:");
console.log("- is developer?", hasRole(developerCtx, 'developer')); // Should be true
console.log("- is admin?", hasRole(developerCtx, 'admin'));         // Should be true (hierarchy)
console.log("- is user?", hasRole(developerCtx, 'user'));           // Should be true

// Test Admin Context
console.log("\nChecking Admin User:");
console.log("- is developer?", hasRole(adminCtx, 'developer'));     // Should be false
console.log("- is admin?", hasRole(adminCtx, 'admin'));             // Should be true
console.log("- is user?", hasRole(adminCtx, 'user'));               // Should be true

// Test Regular User Context
console.log("\nChecking Regular User:");
console.log("- is developer?", hasRole(userCtx, 'developer'));      // Should be false
console.log("- is admin?", hasRole(userCtx, 'admin'));              // Should be false
console.log("- is user?", hasRole(userCtx, 'user'));                // Should be true

if (
    hasRole(developerCtx, 'developer') === true &&
    hasRole(developerCtx, 'admin') === true &&
    hasRole(adminCtx, 'developer') === false &&
    hasRole(adminCtx, 'admin') === true &&
    hasRole(userCtx, 'admin') === false
) {
    console.log("\n✅ Role Verification PASSED");
    process.exit(0);
} else {
    console.error("\n❌ Role Verification FAILED");
    process.exit(1);
}
