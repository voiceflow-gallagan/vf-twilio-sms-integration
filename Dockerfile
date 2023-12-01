FROM oven/bun:latest

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y curl

COPY package*.json bun.lockb ./

RUN bun install --omit=dev

COPY src ./src

# run the app
USER bun
ENTRYPOINT [ "bun", "run", "app" ]
