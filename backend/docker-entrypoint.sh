#!/bin/sh
# Arranque del contenedor del backend:
#   1. aplica las migraciones pendientes (idempotente),
#   2. siembra catálogos y admin inicial (idempotente; el admin solo si no existe),
#   3. arranca la API.
set -e

if [ "${PERSISTENCIA:-postgres}" = "firestore" ]; then
  if [ "${MQ_SEED_AL_ARRANCAR:-true}" = "true" ]; then
    echo "[mq] sembrando catálogos en Firestore..."
    npm run seed:firestore
  fi
else
  echo "[mq] aplicando migraciones..."
  npx prisma migrate deploy
  if [ "${MQ_SEED_AL_ARRANCAR:-true}" = "true" ]; then
    echo "[mq] sembrando catálogos..."
    npx prisma db seed
  fi
fi

echo "[mq] arrancando API..."
exec "$@"
