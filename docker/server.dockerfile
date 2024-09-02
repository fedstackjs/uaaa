FROM node:20-alpine

ENV NODE_ENV production
WORKDIR /opt
ARG SERVER_VERSION=latest
RUN npm install @uaaa/server@$SERVER_VERSION
ARG ADD_PLUGINS=@uaaa/plugin-iaaa@latest
RUN if [ "$ADD_PLUGINS" != "" ]; then npm install $ADD_PLUGINS; fi

USER node

CMD [ "npm", "exec", "uaaa-server", "--", "--config", "config.json" ]