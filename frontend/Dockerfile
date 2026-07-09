FROM node:20-bookworm-slim AS build

WORKDIR /usr/src/app
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_LOGLEVEL=error

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --ignore-scripts --registry=https://registry.npmjs.org/ \
    && test -f node_modules/rollup/dist/bin/rollup

COPY frontend ./frontend
WORKDIR /usr/src/app/frontend
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /usr/src/app/frontend
ENV NODE_ENV=production

COPY --from=build /usr/src/app/frontend/public ./public
COPY --from=build /usr/src/app/frontend/server.js ./server.js

EXPOSE 8080

CMD ["node", "server.js", "--host", "0.0.0.0", "--port", "8080"]
