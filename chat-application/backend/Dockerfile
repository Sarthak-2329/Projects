FROM node:22-alpine

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY src ./src

EXPOSE 3000
CMD ["node", "src/server.js"]
