FROM node:20-bookworm-slim

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

CMD ["sh", "-c", "npm run db:sync && npm run start"]
