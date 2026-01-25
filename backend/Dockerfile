# This Dockerfile is intentionally minimal
# Railway should use Nixpacks (configured in railway.toml and nixpacks.toml)
# This file exists only to prevent Railway from auto-generating one

FROM node:20

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Start
CMD ["npm", "start"]
