FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY .env* ./
EXPOSE 3001
CMD ["node", "server/index.js"]
