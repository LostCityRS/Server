FROM node:lts-slim

RUN apt update \
  && apt install -y --no-install-recommends git ca-certificates bash \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/server
COPY . .

# the subprojects are cloned into game/ at runtime and game/save holds the data worth keeping -
# it is mounted as a volume, and has to exist here so it isn't created owned by root
RUN mkdir -p game && chown -R node:node /opt/server

USER node

RUN npm install

EXPOSE 8888/tcp
WORKDIR /opt/server/game
ENTRYPOINT ["node", "/opt/server/start.js"]
