FROM node:20-bookworm-slim AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /usr/src/app/public ./public
COPY --from=build /usr/src/app/server.js ./server.js

EXPOSE 8080

CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "8080"]
