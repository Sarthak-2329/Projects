# Stage 1: Build the React/Vite app
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package.json so the "file:.." local dependency resolves correctly
COPY package.json ./

# Install frontend dependencies
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

# Copy frontend source and build
COPY frontend/ .
RUN npm run build


# Stage 2: Serve built assets via nginx
FROM nginx:alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Custom nginx config: SPA routing + proxy to backend API and Socket.io
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
