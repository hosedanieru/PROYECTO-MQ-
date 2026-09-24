# Despliegue y entornos

## Desarrollo local (Windows)

Requisitos: Node 22, PostgreSQL 18 local, Google Chrome (para el PDF).

```powershell
# backend
cd backend
copy .env.example .env      # completar DATABASE_URL, JWT_SECRET, ADMIN_INICIAL_*, PUPPETEER_EXECUTABLE_PATH
npm ci
npx prisma generate
npx prisma migrate dev
npx prisma db seed          # catálogos + administrador inicial
npm run start:dev           # http://localhost:3000/api

# frontend
cd frontend
npm ci
npm run dev                 # http://localhost:5173 (proxy /api → 3000)
```

`PUPPETEER_EXECUTABLE_PATH` apunta a un Chrome ya instalado. Sin él, Puppeteer usa el Chrome que descarga en `~/.cache/puppeteer` al hacer `npm install`; esa descarga falla si la ruta del perfil de usuario tiene acentos.

## Pruebas

```powershell
cd backend
npm test            # 189 unitarias, sin base de datos
npm run test:e2e    # 8 de integración contra la base mq_test (~70 s; crea la base y migra)

cd frontend
npx tsc -b && npm run lint && npm run build
```

`backend/.env.test` (ver `.env.test.example`) debe apuntar a una base cuyo nombre termine en `_test`; el setup se niega a correr contra otra.

## Docker Compose (producción / demo)

```text
infrastructure/
├── docker-compose.yml   db (PostgreSQL 18) + backend + frontend (nginx)
└── .env.example         copiar a .env y completar
```

```bash
cd infrastructure
cp .env.example .env     # POSTGRES_PASSWORD, JWT_SECRET, ADMIN_INICIAL_* …
docker compose config    # valida
docker compose up -d --build
# web en http://localhost (PUERTO_WEB)
```

Qué hace cada contenedor al arrancar:

- **db**: al crear el volumen ejecuta `database/crear-usuario-app.sql` (rol `mq_app` con permisos limitados; cambiar su clave con `ALTER ROLE`).
- **backend** (`docker-entrypoint.sh`): `prisma migrate deploy` → `prisma db seed` (desactivable con `MQ_SEED_AL_ARRANCAR=false`) → `node dist/main.js`. Usa el Chromium del sistema para el PDF. Corre como usuario sin privilegios. `shm_size: 512m` para Chromium.
- **frontend**: nginx sirve la SPA y reenvía `/api/` al backend por la red interna. Solo este servicio expone puerto.

Pendientes de producción (no bloquean): HTTPS (proxy inverso o certificados en nginx), respaldos programados del volumen `mq_postgres`, usar `mq_app` en `DATABASE_URL` de la API (las migraciones seguirían con el superusuario), y decidir dónde se despliega (servidor propio / nube) y quién lo administra.

**Nota:** el archivo de Compose se escribió sin poder ejecutarlo en la máquina de desarrollo (Docker sin el plugin Compose). Validar con `docker compose config` antes del primer despliegue.

## Integración continua

`.github/workflows/ci.yml`, en cada push a `main` y en cada pull request:

| Job | Pasos |
|---|---|
| Backend | `npm ci` → `prisma generate` → `tsc --noEmit` → unitarias → integración contra un PostgreSQL 18 de servicio → `nest build` |
| Frontend | `npm ci` → `tsc -b` → `oxlint` → `vite build` |

El PDF en CI usa el Google Chrome preinstalado en los runners de GitHub (`/usr/bin/google-chrome`).

## Firestore en lugar de PostgreSQL

1. Crear el proyecto en https://console.firebase.google.com y activar **Firestore Database** (modo producción).
2. ⚙ Configuración del proyecto → **Cuentas de servicio** → "Generar nueva clave privada" → descarga un JSON.
3. En `backend/.env`: `PERSISTENCIA=firestore` y, del JSON, `project_id` → `FIREBASE_PROJECT_ID`, `client_email` → `FIREBASE_CLIENT_EMAIL`, `private_key` → `FIREBASE_PRIVATE_KEY` (entre comillas, con los `\n` tal cual vienen).
4. `npm run seed:firestore` (catálogos y administrador inicial).
5. Desplegar reglas e índices: `cd infrastructure/firebase && firebase deploy --only firestore:rules,firestore:indexes`.
6. `npm run start:dev`. Todo lo demás (frontend, Docker, CI) es igual.

## Variables de entorno del backend

| Variable | Obligatoria | Para qué |
|---|---|---|
| `PERSISTENCIA` | no (`postgres`) | `postgres` o `firestore` |
| `DATABASE_URL` | con postgres | conexión PostgreSQL |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | con firestore | cuenta de servicio de Firebase |
| `FIRESTORE_EMULATOR_HOST` | no | emulador local (`localhost:8080`) |
| `JWT_SECRET` | sí (≥ 32 chars) | firma de tokens; la app no arranca sin él |
| `JWT_EXPIRES_IN` | no (12h) | vigencia del token (`12h`, `30m`, `7d`) |
| `ADMIN_INICIAL_DOCUMENTO` / `_NOMBRE` / `_PASSWORD` | para el seed | administrador inicial; solo se crea si no existe |
| `PUPPETEER_EXECUTABLE_PATH` | recomendado | Chrome/Chromium para el PDF |
| `PORT` | no (3000) | |
| `TZ` | no | `America/Bogota`; el día operativo se calcula siempre en esa zona aunque falte |
| `CORS_ORIGIN` | no (`http://localhost:5173`) | origen del frontend en desarrollo |
| `OBSERVE_APP_KEY` / `_SECRET` | no | APM de NestJS, solo si hay credenciales |

Nunca se suben `.env` a Git; `.env.example` y `.env.test.example` sí.
