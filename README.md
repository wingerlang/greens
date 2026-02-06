# Guardian 3.0

Guardian is a high-performance reverse proxy and dashboard system built with Deno 2.

## Quick Start

### Prerequisites
- [Docker](https://www.docker.com/) installed
- [Deno 2](https://deno.com/) installed (optional, for local dev)

### Running with Docker (Recommended)

The easiest way to run Guardian is using Docker Compose:

```bash
docker-compose up --build
```

This will start:
- **Proxy**: http://localhost:8000
- **Dashboard**: http://localhost:9999

### Running Locally

1.  **Install dependencies**:
    ```bash
    deno install
    ```

2.  **Start in Development Mode** (Hot Reload):
    ```bash
    deno task server
    ```
    And separately start the frontend (if needed, though Guardian manages it):
    ```bash
    deno task dev
    ```

3.  **Start in Production Mode**:
    ```bash
    deno task build
    deno task go -- --mode=prod
    ```

## Project Structure

- `deno.json`: Main configuration and dependencies (Import Map).
- `src/`: Source code for Guardian backend and API.
- `scripts/guardian/`: Core Guardian logic (middleware, services).
- `docker-compose.yml`: Docker orchestration.
