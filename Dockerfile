FROM denoland/deno:latest

WORKDIR /app

# Copy dependency definitions
COPY deno.json .
COPY package.json .

# Cache dependencies (including npm packages via Deno)
# We cache the entrypoint to download deps
COPY scripts/guardian/main.ts scripts/guardian/main.ts
# We also need to cache other files that have imports, but main.ts imports most things.
# To be safe, let's copy everything first since we are building.
# Or better:
COPY . .

# Cache dependencies
RUN deno cache --unstable-kv scripts/guardian/main.ts

# Build the frontend
RUN deno task build

# Expose ports
# 8000: Main Proxy
# 9999: Dashboard
# 3000: Frontend (Direct/Dev) - optional in prod since we serve via internal port
EXPOSE 8000 9999 3000

# Set default mode to prod
ENV DENO_ENV=production
ENV GUARDIAN_DB_PATH=/app/data/guardian.db

# Start Guardian
# We pass --mode=prod to force production mode (serving dist/)
CMD ["deno", "task", "go", "--", "--mode=prod"]
