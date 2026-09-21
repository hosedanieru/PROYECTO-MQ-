# =============================================================
# FRONTEND MQ — imagen de producción
# =============================================================
#
#   build   compila la SPA con Vite
#   runtime nginx sirve los estáticos y reenvía /api al backend
#           (mismo papel que el proxy de Vite en desarrollo)

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
