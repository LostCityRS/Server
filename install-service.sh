#!/bin/bash

set -e

if [ "$(id -u)" -ne 0 ]; then
	echo You must run this as root
	exit 1
fi

if ! command -v docker >/dev/null; then
	echo You must install Docker to proceed: https://docs.docker.com/engine/install/debian/
	exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
	echo You must install the Docker Compose plugin to proceed: apt install docker-compose-plugin
	exit 1
fi

dir="$(cd "$(dirname "$0")" && pwd)"
docker="$(command -v docker)"

# docker would create these as root, but the container runs as uid 1000
mkdir -p /srv/lostcity/game
chown -R 1000:1000 /srv/lostcity

cat > /etc/systemd/system/lostcity.service <<EOF
[Unit]
Description=Lost City server
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$dir
ExecStart=$docker compose up -d
ExecStop=$docker compose down
# the first start builds the image and clones the sources, which is not quick
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now lostcity.service

echo
echo Installed as lostcity.service - it will now start on boot.
echo
echo "  systemctl status lostcity      is it running?"
echo "  systemctl stop lostcity        stop it"
echo "  docker compose logs -f         watch the server (run from $dir)"
echo
echo "  /srv/lostcity/game/save/players   drop .sav files in here"
echo
echo The first start clones the sources and then waits for you to finish setup at:
echo "  http://$(hostname -I | awk '{print $1}'):8898/setup"
