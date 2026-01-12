from playwright.sync_api import sync_playwright
import json

def verify_muscle_load(page):
    try:
        print("Navigating to Load Analysis...")
        page.goto("http://localhost:3002/training/load")

        page.wait_for_selector("text=Belastningsanalys", timeout=10000)

        print("Selecting muscle 'Bröst'...")
        select = page.locator("select").first
        select.wait_for()
        select.select_option(label="Mellersta bröst (Bröst)")

        # Wait for graph
        print("Waiting for graph...")
        page.wait_for_selector("text=Belastning över tid", timeout=10000)
        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/load_analysis.png")
        print("Screenshot saved: load_analysis.png")

        print("Navigating to Muscle Overview...")
        page.goto("http://localhost:3002/exercises/muscles")
        page.wait_for_selector("text=Muskelöversikt", timeout=10000)

        page.get_by_text("Överkropp").click()
        page.get_by_text("Bröst").click()
        page.get_by_role("button", name="Mellersta bröst").click()

        page.wait_for_selector("text=Primärt Fokus", timeout=10000)
        page.screenshot(path="/home/jules/verification/muscle_overview.png")
        print("Screenshot saved: muscle_overview.png")
    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="/home/jules/verification/error.png")
        print("Screenshot saved: error.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"Browser error: {exc}"))

        # Mock API
        def handle_login(route):
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"token": "fake-token", "user": {"id": "1", "username": "admin", "role": "admin"}}))

        def handle_me(route):
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"user": {"id": "1", "username": "admin", "role": "admin"}}))

        def handle_workouts(route):
            print("Intercepted /api/strength/workouts")
            data = [
                {
                    "date": "2026-01-01T12:00:00Z",
                    "exercises": [
                        {
                            "exerciseId": "bench_press",
                            "sets": [{"weight": 100, "reps": 10}, {"weight": 100, "reps": 10}]
                        }
                    ]
                },
                {
                    "date": "2026-01-05T12:00:00Z",
                    "exercises": [
                        {
                            "exerciseId": "bench_press",
                            "sets": [{"weight": 110, "reps": 8}]
                        }
                    ]
                }
            ]
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"workouts": data}))
            # Note: The API returns { workouts: [...] }, not just [...]

        page.route("**/api/auth/login", handle_login)
        page.route("**/api/auth/me", handle_me)
        page.route("**/api/strength/workouts**", handle_workouts) # Corrected path
        page.route("**/api/exercises", lambda r: r.fulfill(status=200, body=json.dumps([])))

        print("Injecting auth token...")
        page.goto("http://localhost:3002/login")

        # Inject token
        page.evaluate("""() => {
            localStorage.setItem('auth_token', 'fake-token');
        }""")

        # Navigate to home
        print("Navigating to home...")
        page.goto("http://localhost:3002/")

        # Check if we are logged in
        try:
            page.wait_for_selector("text=Veckan", timeout=5000)
            print("Logged in successfully.")
        except:
            print("Warning: Might not be logged in fully, but proceeding...")

        verify_muscle_load(page)
        browser.close()
