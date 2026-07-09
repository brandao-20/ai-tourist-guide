FROM node:20-bookworm-slim

WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_LOGLEVEL=error

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --omit=dev --ignore-scripts --registry=https://registry.npmjs.org/ \
    && test -d node_modules/express

COPY backend ./backend
WORKDIR /usr/src/app/backend

EXPOSE 5000

CMD ["sh", "-c", "npm run db:sync && npm run start"]
