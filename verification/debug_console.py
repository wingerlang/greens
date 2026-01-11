
from playwright.sync_api import sync_playwright

def debug_console():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))
        page.on("requestfailed", lambda req: print(f"REQUEST FAILED: {req.url} - {req.failure}"))

        print("Navigating to http://localhost:3000/login...")
        try:
            page.goto("http://localhost:3000/login", timeout=10000)
            print("Navigation complete.")
            # Wait a bit for potential async errors
            page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Navigation Error: {e}")

        browser.close()

if __name__ == "__main__":
    debug_console()
