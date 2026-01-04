
from playwright.sync_api import sync_playwright

def verify_tools_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Login first (mocking or real login depending on app setup)
        # Since I cannot easily login with auth, I will try to bypass or assume dev mode allows access.
        # However, the RequireAuth wrapper redirects to /login.
        # I need to mock the auth or login.

        # Let's try to hit the login page and see if we can login with test user or just see if the page loads.
        # But wait, I can just check if the components render if I navigate to /tools.
        # If blocked by auth, I need to login.

        # Trying to login
        # NOTE: Vite started on port 3000, not 5173
        page.goto("http://localhost:3000/login")
        page.wait_for_timeout(2000) # Wait for load

        # Fill login form (assuming standard fields)
        # The codebase has a create_test_users.ts, maybe I can use a known user or register one.
        # Or I can just inspect the code to see if there's a bypass.
        # `src/context/AuthContext.tsx` seems to check against a backend.

        # Let's try a common test credential if I can find one, or just register.
        # Actually, for verification I might just need to see the page structure.
        # If I can't login easily, I might skip deep interaction and trust unit tests + code review.

        # However, let's try to just visit the page and take a screenshot of where we end up.
        # If it's the login page, so be it. But ideally I want to see the tools.

        # NOTE: I don't have a guaranteed user credential.
        # I'll try to register a new user quickly.
        page.goto("http://localhost:3000/register")
        page.fill('input[type="text"]', "tools_tester")
        page.fill('input[type="password"]', "password123")
        # Assuming there is a submit button
        page.get_by_role("button", name="Registrera").click()
        page.wait_for_timeout(2000)

        # Navigate to Tools
        page.goto("http://localhost:3000/tools")
        page.wait_for_timeout(2000)
        page.screenshot(path="verification/tools_page.png")

        # Navigate to 1RM Tool
        page.goto("http://localhost:3000/tools/1rm")
        page.wait_for_timeout(2000)
        page.screenshot(path="verification/1rm_tool.png")

        browser.close()

if __name__ == "__main__":
    verify_tools_page()
