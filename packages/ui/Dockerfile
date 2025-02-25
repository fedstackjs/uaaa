FROM node:22 AS builder
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
COPY packages/ui/package.json ./packages/ui/
RUN yarn workspaces focus @uaaa/ui
COPY . .
RUN yarn workspaces foreach -Rp --topological-dev --from @uaaa/ui run build

FROM caddy:latest
COPY --from=builder /app/packages/ui/.output/public /var/www/uaaa
