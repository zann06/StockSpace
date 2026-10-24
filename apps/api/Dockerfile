# StockSpace API — build inside the workspace layout, run from compiled output.
FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY prisma prisma
RUN npm ci --workspaces --include-workspace-root

COPY apps/api apps/api
RUN npm run build -w apps/api

# Prisma engines are platform-specific — regenerate for the runtime image.
RUN npx prisma generate

FROM node:22-alpine
WORKDIR /repo

ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/prisma ./prisma
COPY --from=build /repo/package.json ./package.json

EXPOSE 4000
WORKDIR /repo/apps/api
CMD ["node", "dist/server.js"]
