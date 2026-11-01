# Pin NODE_IMAGE to an approved digest in a release pipeline when available.
ARG NODE_IMAGE=node:26.13.0-bookworm-slim
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
ENV SCARF_ANALYTICS=false YARN_ENABLE_IMMUTABLE_INSTALLS=true
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases/ .yarn/releases/
RUN node .yarn/releases/yarn-4.18.1.cjs install --immutable

FROM dependencies AS build
COPY tsconfig.json ./
COPY scripts/build.mjs ./scripts/build.mjs
COPY src ./src
RUN node .yarn/releases/yarn-4.18.1.cjs build

FROM dependencies AS production-dependencies
ENV NODE_ENV=production SCARF_ANALYTICS=false
RUN node .yarn/releases/yarn-4.18.1.cjs workspaces focus --all --production \
    && node .yarn/releases/yarn-4.18.1.cjs cache clean

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json LICENSE ./
RUN mkdir -p /app/storage/public && chown -R node:node /app/storage
USER node
EXPOSE 8000
STOPSIGNAL SIGTERM
CMD ["node", "--enable-source-maps", "dist/index.js"]
