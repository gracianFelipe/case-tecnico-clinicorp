FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm run build --workspace apps/api

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/db apps/api/db
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
