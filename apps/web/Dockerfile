# Build stage — compile the Vite app inside the workspace layout
FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspaces --include-workspace-root

COPY apps/web apps/web
RUN npm run build -w apps/web

# Serve stage — static SPA with history fallback
FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
