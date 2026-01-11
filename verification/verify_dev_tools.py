
from playwright.sync_api import sync_playwright, expect

def verify_dev_tools():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Increase viewport size to see full dashboard
        context = browser.new_context(viewport={"width": 1600, "height": 900})
        page = context.new_page()

        # 1. Login
        print("Navigating to login...")
        page.goto("http://localhost:3000/login")
        page.wait_for_load_state('networkidle')

        if page.locator('input[type="email"]').count() > 0:
            print("Logging in as admin...")
            page.fill('input[type="email"]', 'admin@greens.se')
            page.fill('input[type="password"]', 'admin')
            page.click('button[type="submit"]')
            page.wait_for_url("http://localhost:3000/", timeout=10000)
            print("Login successful.")
        else:
            print("Already logged in (or redirected).")

        # 2. Navigate to Developer Dashboard
        print("Navigating to Developer Tools...")
        page.goto("http://localhost:3000/developer")
        page.wait_for_load_state('networkidle')

        # 3. Verify Explorer
        print("Verifying Explorer...")
        # Check for "Code Explorer" title
        expect(page.get_by_text("Code Explorer")).to_be_visible(timeout=10000)

        # Toggle Stats
        print("Toggling Stats...")
        page.click("text=Show Stats")
        page.wait_for_timeout(2000) # Wait for stats to load

        # Search for a file
        print("Searching for 'Developer'...")
        page.fill('input[placeholder="Search codebase..."]', "Developer")
        page.wait_for_timeout(2000)

        # Take screenshot of Explorer
        page.screenshot(path="/home/jules/verification/dev_explorer.png")
        print("Explorer Screenshot saved.")

        # 4. Navigate to Analysis
        print("Navigating to Analysis...")
        page.goto("http://localhost:3000/developer/analysis")
        page.wait_for_load_state('networkidle')

        # Verify Settings
        print("Verifying Settings...")
        page.click("text=Settings")
        expect(page.get_by_text("Max Lines per File")).to_be_visible()

        # Verify Tabs
        print("Verifying Tabs...")
        page.click("text=Function Duplicates")
        page.wait_for_timeout(1000)

        page.click("text=Code Similarity")
        page.wait_for_timeout(1000)

        # Take screenshot of Analysis
        page.screenshot(path="/home/jules/verification/dev_analysis.png")
        print("Analysis Screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_dev_tools()
