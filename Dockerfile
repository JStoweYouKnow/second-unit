FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY api/_lib/ ./api/_lib/
EXPOSE 3001
CMD ["node", "server/index.js"]
