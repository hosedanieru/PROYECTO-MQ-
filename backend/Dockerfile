# =============================================================
# BACKEND MQ — imagen de producción
# =============================================================
#
# Dos etapas:
#   build   compila TypeScript y genera el cliente Prisma
#   runtime Node + Chromium del sistema (para el PDF con Puppeteer)
#
# Prisma 7 usa driver adapters (PrismaPg), así que no necesita el motor
# binario de consultas: la imagen final no lleva nada específico de la
# plataforma salvo Chromium.

# ---------- build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Chromium se instala en la etapa runtime; aquí no hace falta descargarlo.
ENV PUPPETEER_SKIP_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npx prisma generate && npm run build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    TZ=America/Bogota

# Chromium + fuentes para el PDF. `fonts-liberation` da un Arial métrico
# compatible; sin fuentes, Chromium imprime cuadros.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Se instalan también las dependencias de desarrollo porque `prisma migrate
# deploy` (en el arranque) necesita la CLI de Prisma y `tsx` para el seed.
RUN npm ci --ignore-scripts \
 && npm rebuild bcrypt \
 && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Chromium no debe correr como root; tampoco la aplicación.
RUN groupadd -r mq && useradd -r -g mq -d /app mq && chown -R mq:mq /app
USER mq

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
