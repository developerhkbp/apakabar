# Gateway ApaKabaR. Build dari folder apps/gateway:
#   docker build -t asia-southeast2-docker.pkg.dev/hkbp-superapp-prod/hkbp-superapp/apakabar-gateway:TAG apps/gateway
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npx tsc -p tsconfig.json --outDir dist --noEmit false

FROM node:22-slim AS jalan
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN mkdir -p /data/berkas && chown -R node:node /data /app
USER node
ENV PORT=3101 BERKAS_DIR=/data/berkas
EXPOSE 3101
CMD ["node", "dist/src/main.js"]
