FROM node:22 AS builder
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
RUN yarn workspaces focus @uaaa/server
COPY . .
RUN yarn workspaces foreach -Rp --topological-dev --from @uaaa/server run build

FROM node:22
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
RUN yarn workspaces focus @uaaa/server --production
COPY --from=builder /app/packages/core/lib ./packages/core/lib
COPY --from=builder /app/packages/server/lib ./packages/server/lib
USER node
VOLUME [ "/etc/uaaa" ]
CMD ["node", "packages/server/lib/cli/index.js", "serve", "--config", "/etc/uaaa/config.json"]
