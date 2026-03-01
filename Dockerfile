FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY prisma ./prisma/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest
COPY . .

# Generate Prisma client and push schema
RUN bunx prisma generate

# Build the app
RUN bun run build

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Create seed and start
CMD ["sh", "-c", "bun run start"]
