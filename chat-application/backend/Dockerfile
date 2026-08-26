FROM node:22-alpine

WORKDIR /app

# Copy root package.json so the "file:.." local dependency resolves correctly
COPY package.json ./

# Install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

# Copy backend source
COPY backend/src ./src

EXPOSE 3000
CMD ["node", "src/server.js"]
