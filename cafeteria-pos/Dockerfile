# Imagen única: el backend Express sirve la API (/api) y el frontend compilado.

# ---- 1. Compilar el frontend ----
FROM node:22-alpine AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- 2. Backend + frontend estático ----
FROM node:22-alpine
# openssl: requerido por el motor de Prisma. La zona horaria (TZ) la resuelve
# Node con su propia base ICU, no hace falta tzdata.
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    TZ=America/Santiago \
    PORT=4000 \
    DATABASE_URL=file:/app/data/pos.db

WORKDIR /app/server
COPY server/package*.json ./
# El schema va antes de `npm ci`: su postinstall ejecuta `prisma generate`.
COPY server/prisma ./prisma
RUN npm ci --omit=dev
COPY server/src ./src
COPY --from=web /app/web/dist ./public

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
VOLUME /app/data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4000/api/health || exit 1

# Aplica migraciones pendientes, siembra datos demo solo si la base está vacía
# y arranca. `exec` deja a node como PID 1 para recibir SIGTERM (cierre limpio).
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && exec node src/index.js"]
