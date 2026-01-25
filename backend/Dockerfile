# This Dockerfile is intentionally minimal
# Railway should use Nixpacks (configured in railway.toml and nixpacks.toml)
# This file exists only to prevent Railway from auto-generating one

FROM node:20

WORKDIR /app

# Copy package files (explicitly copy both)
COPY package.json package-lock.json ./

# Install dependencies (skip postinstall to avoid build before source is copied)
RUN npm ci --ignore-scripts

# Copy source and config files needed for build
COPY tsconfig.json ./
COPY src ./src
COPY public ./public

# Build
RUN npm run build

# Start
CMD ["npm", "start"]
