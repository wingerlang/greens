
from playwright.sync_api import sync_playwright
import os
import json
import time

def handle_status(route):
    route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps({
            "services": [
                {"name": "backend", "status": "running", "cpu": 1.5, "memory": 50*1024*1024, "restarts": 0, "uptime": 120},
                {"name": "frontend", "status": "stopped", "cpu": 0, "memory": 0, "restarts": 1, "uptime": 0},
                {"name": "guardian", "status": "running", "cpu": 0.1, "memory": 20*1024*1024, "restarts": 0, "uptime": 300}
            ],
            "system": { "total": 16*1024*1024*1024, "free": 8*1024*1024*1024 },
            "load": [0.5, 0.3, 0.1]
        })
    )

def handle_logs(route):
    route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps([
            {"id": "1", "timestamp": "2023-10-27T10:00:00Z", "source": "info", "message": "Service started"},
            {"id": "2", "timestamp": "2023-10-27T10:00:01Z", "source": "stdout", "message": "Listening on port 8000"}
        ])
    )

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.route("**/api/status", handle_status)
        page.route("**/api/logs*", handle_logs)
        page.goto("http://localhost:8081/guardian_dashboard.html")
        page.wait_for_selector(".card")
        page.screenshot(path="verification/dashboard_overview.png")
        browser.close()

if __name__ == "__main__":
    run()
