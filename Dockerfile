FROM oven/bun:debian

RUN apt update \
  && apt install -y --no-install-recommends default-jdk git ca-certificates bash \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/server
COPY . .

RUN chown -R bun:bun /opt/server

USER bun

RUN bun install

EXPOSE 8888/tcp
ENTRYPOINT ["/opt/server/start.sh"]
