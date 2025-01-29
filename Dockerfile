# Base image
FROM oven/bun:latest

# Set the working directory
WORKDIR /app

# Copy package and lock files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy the rest of the source code
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the development server
CMD ["bun", "run", "dev"]