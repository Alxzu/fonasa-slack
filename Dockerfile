FROM oven/bun:1 AS base
WORKDIR /app

# Install Chromium and deps (works on both amd64 and arm64)
RUN apt-get update && apt-get install -y \
  chromium \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Tell Playwright to use system Chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
