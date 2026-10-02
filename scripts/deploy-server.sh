#!/usr/bin/env bash
set -Eeuo pipefail

image="${1:?Pass the image tag to deploy}"
container=gank-post-notify
backup=gank-post-notify-previous
state_volume=gank-post-notify-state
host_port=3000
had_previous=false
new_started=false
committed=false

# Serialize manual and CI deployments on this host.
exec 9>/tmp/gank-post-notify-deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }

# All checks happen before touching the running service.
: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN in GitHub Actions Secrets}"
: "${TELEGRAM_CHAT_ID:?Set TELEGRAM_CHAT_ID in GitHub Actions Secrets}"
export TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID
docker image inspect "$image" >/dev/null
if docker container inspect "$backup" >/dev/null 2>&1; then
  echo "Backup container $backup exists; recover it before deploying again." >&2
  exit 1
fi

on_exit() {
  status=$?
  trap - EXIT
  if (( status == 0 )) || [[ "$committed" == true ]]; then
    return
  fi
  echo 'Deployment failed; restoring the previous container.' >&2
  if [[ "$new_started" == true ]]; then
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi
  if [[ "$had_previous" == true ]]; then
    docker rename "$backup" "$container" && docker start "$container" >/dev/null || {
      echo "Automatic recovery failed; inspect $container and $backup." >&2
    }
  fi
  exit "$status"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if docker container inspect "$container" >/dev/null 2>&1; then
  docker rename "$container" "$backup"
  had_previous=true
  docker stop --time 60 "$backup" >/dev/null
fi

# A named volume retains notification state across deployments and rollbacks.
# Docker copies the image directory's ownership when initializing a new volume.
new_started=true
docker run -d \
  --name "$container" \
  --init \
  --restart unless-stopped \
  --stop-timeout 60 \
  --env TELEGRAM_BOT_TOKEN --env TELEGRAM_CHAT_ID \
  --mount "type=volume,source=$state_volume,target=/app/data" \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  -p "127.0.0.1:$host_port:3000" \
  "$image" >/dev/null

for attempt in {1..60}; do
  running="$(docker inspect --format '{{.State.Running}}' "$container")"
  health="$(docker inspect --format '{{.State.Health.Status}}' "$container")"
  if [[ "$running" != true ]]; then
    echo 'The new container stopped unexpectedly.' >&2
    exit 1
  fi
  if [[ "$health" == healthy ]]; then
    committed=true
    if [[ "$had_previous" == true ]]; then
      docker rm "$backup" >/dev/null
    fi
    echo "Deployed $image and passed the health check."
    exit 0
  fi
  sleep 3
done

echo 'The new container did not become healthy within 180 seconds.' >&2
exit 1
