#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="ghcr.io/exomonk/poly-api"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"

echo "Building poly-api image (linux/amd64)..."
docker build \
    --platform linux/amd64 \
    -f "$ROOT/deployments/Dockerfile" \
    -t "$IMAGE:$SHA" \
    -t "$IMAGE:latest" \
    "$ROOT"

echo "Logging in to GHCR..."
gh auth token | docker login ghcr.io -u exomonk --password-stdin

echo "Pushing $IMAGE:$SHA..."
docker push "$IMAGE:$SHA"

echo "Pushing $IMAGE:latest..."
docker push "$IMAGE:latest"

echo ""
echo "Published: $IMAGE:$SHA"
echo "Published: $IMAGE:latest"
