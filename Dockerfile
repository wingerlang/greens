FROM denoland/deno:latest

WORKDIR /app

# 1. Cache dependencies
# Copy config files first to leverage Docker layer caching.
# If these files don't change, this layer is cached, speeding up builds.
COPY deno.json deno.lock* package.json* ./

# Install dependencies defined in deno.json (and package.json if present)
# --allow-scripts allows packages (like esbuild) to run their install scripts
RUN deno install --allow-scripts

# 2. Copy source code
COPY . .

# 3. Build Frontend
# This generates the 'dist/' folder which Guardian serves in production
RUN deno task build

# 4. Runtime Configuration
EXPOSE 8000 9999

# Environment defaults
ENV DENO_ENV=production
ENV GUARDIAN_DB_PATH=/app/data/guardian.db

# 5. Start Application
CMD ["deno", "task", "go", "--", "--mode=prod"]
