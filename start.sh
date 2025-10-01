#!/bin/sh

if ! command -v git 2>&1 >/dev/null; then
	echo You must install Git to proceed
	exit 1
fi

if ! command -v node 2>&1 >/dev/null; then
        echo You must install Node to proceed
        exit 1
fi

node_major=$(node --version | sed 's/^v//' | cut -d'.' -f1)
if [ "$node_major" -lt 22 ]; then
        echo Node 22 or newer is required. Detected $(node --version)
        exit 1
fi

if ! command -v bun 2>&1 >/dev/null; then
	npm i -g bun
fi

if ! command -v bun 2>&1 >/dev/null; then
	echo You must install Bun to proceed
	exit 1
fi

if ! command -v java 2>&1 >/dev/null; then
	echo You must install Java 17 or newer to proceed
	exit 1
fi

# todo: this can return a non-empty string and fail on macOS
# "The operation couldn’t be completed. Unable to locate a Java Runtime.
# Please visit http://www.java.com for information on installing Java."

jver=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | sed '/^1\./s///' | cut -d'.' -f1)
if [ "$jver" -lt 17 ]; then
	echo You must install Java 17 or newer to proceed
	echo And it must be your primary Java version!
	exit 1
fi

bun install
bun run start.ts
