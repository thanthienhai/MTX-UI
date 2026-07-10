# Build and deploy MTX-UI

This guide deploys the dashboard behind an HTTPS reverse proxy with HLS and WebRTC preview endpoints that do not trigger browser mixed-content errors.

## Prerequisites

- Docker Engine and Docker Compose (either `docker compose` or legacy `docker-compose`).
- A DNS name with a valid TLS certificate.
- MediaMTX reachable from the dashboard container for the Control API and from the reverse-proxy host on ports 8888 (HLS) and 8889 (WebRTC).

Do not commit `.env`. It contains credentials and `RELAY_SESSION_SECRET`.

## Production environment

Create/update `.env` beside `docker-compose-fe.yml`:

```env
NEXT_PUBLIC_MEDIAMTX_API_URL=/api/mediamtx
MEDIAMTX_API_URL=http://<mediamtx-host>:9997

# Browser-visible URLs are embedded at image build time.
NEXT_PUBLIC_MEDIAMTX_HLS_URL=https://dashboard.example.com/hls
NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL=https://dashboard.example.com/webrtc

# Used only by server-side public HLS proxy.
MEDIAMTX_HLS_URL=http://<mediamtx-host>:8888

MEDIAMTX_ADMIN_USER=<admin-user>
MEDIAMTX_ADMIN_PASS=<admin-password>
RELAY_SESSION_SECRET=<long-random-secret>
RELAY_ASSET_BASE_URL=https://dashboard.example.com
```

`NEXT_PUBLIC_*` values require an image rebuild. Server-only values can be changed at runtime, but rebuilding is recommended when changing preview routing.

## Nginx HTTPS proxy

Within the TLS `server` block for the dashboard domain, add these locations before `location /`:

```nginx
location ^~ /hls/ {
    proxy_pass http://127.0.0.1:8888/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
}

location ^~ /webrtc/ {
    proxy_pass http://127.0.0.1:8889/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;
}
```

Validate and reload only after validation succeeds:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Safe build and rollout

Build first. This leaves the running dashboard untouched if the build fails:

```bash
cd /path/to/MTX-UI
DOCKER_BUILDKIT=1 docker-compose -f docker-compose-fe.yml build frontend
# Or: docker compose -f docker-compose-fe.yml build frontend
```

Verify the image was built, then replace the container:

```bash
docker-compose -f docker-compose-fe.yml up -d --no-build
# Or: docker compose -f docker-compose-fe.yml up -d --no-build
```

Check health and endpoints:

```bash
curl -fsS https://dashboard.example.com/login >/dev/null
curl -fsSI https://dashboard.example.com/hls/<live-path>/index.m3u8
curl -fsS -X OPTIONS -o /dev/null -w '%{http_code}\n' \
  https://dashboard.example.com/webrtc/<live-path>/whep
```

Expected results: dashboard `200`, HLS `200` or a MediaMTX redirect before the muxer is ready, and WHEP `204` or `405` for an OPTIONS probe.

## Rollback

Before changing Nginx or `.env`, create timestamped backups. If the new frontend does not become healthy, restart the prior container/image before investigating further:

```bash
docker ps -a --filter name=mtx-ui-fe
docker start <previous-container-id>
```

Do not run `up -d --build` as the first deployment action on legacy Docker Compose: it can stop the current frontend before a slow or stalled build finishes. Build separately, verify success, then run `up -d --no-build`.