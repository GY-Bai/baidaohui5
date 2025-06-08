# Base Node.js Docker image for baidaohui services
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS dev
ENV NODE_ENV=development
CMD ["pnpm", "dev"]

# Build stage
FROM base AS build
ENV NODE_ENV=production

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:18-alpine AS production
ENV NODE_ENV=production

# Install pnpm
RUN npm install -g pnpm@8.15.0

WORKDIR /app

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["node", "dist/main.js"] 