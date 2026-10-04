FROM node:20-alpine AS builder

WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
