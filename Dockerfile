FROM oven/bun:alpine AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package files and lock files
COPY package.json bun.lockb /app/

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . /app

# Build the application
RUN bun run build

# Stage 2: Serve the application
FROM nginx:alpine

# Copy the built application to Nginx's html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose the Nginx default port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
