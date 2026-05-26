# Deployment

Tài liệu này tổng hợp các thông tin triển khai cho MediaMTX Dashboard.

## Phương án triển khai

| Phương án | Khi nào dùng | File / lệnh |
| --- | --- | --- |
| Docker Compose (production) | Một host, một cluster nhỏ | `docker compose -f docker-compose.prod.yml up -d` |
| Docker Compose (dev) | Phát triển nội bộ | `docker compose -f docker-compose.dev.yml up` |
| Docker Compose (local) | Test trên máy cá nhân kèm MediaMTX local | `docker compose -f docker-compose.local.yml up` |
| Next.js standalone | Triển khai sau reverse proxy không Docker | `pnpm build && pnpm start` |

`docker-compose.prod.yml` xây image bằng `Dockerfile.prod` (multi-stage, dùng `next start`).
`Dockerfile.simple` và `Dockerfile.debian` là biến thể runtime nhỏ hơn.

## Biến môi trường

| Tên | Mô tả | Mặc định |
| --- | --- | --- |
| `MEDIAMTX_API_URL` | URL upstream MediaMTX Control API (server-side proxy) | `http://localhost:9997` |
| `MEDIAMTX_PLAYBACK_URL` | URL upstream playback server | `http://localhost:9996` |
| `NEXT_PUBLIC_MEDIAMTX_API_URL` | Override URL Control API mặc định khi load dashboard | — |
| `NEXT_PUBLIC_MEDIAMTX_HLS_URL` | URL HLS server hiển thị cho user | `http://localhost:8888` |
| `NEXT_PUBLIC_MEDIAMTX_PLAYBACK_URL` | URL playback server hiển thị cho user | `http://localhost:8888` |
| `NEXT_PUBLIC_MEDIAMTX_METRICS_URL` | URL metrics endpoint | `http://localhost:9998` |
| `NEXT_PUBLIC_MEDIAMTX_PPROF_URL` | URL pprof endpoint | `http://localhost:9999` |
| `NEXT_PUBLIC_BASE_PATH` | Sub-path khi deploy sau reverse proxy (vd. `/dashboard`) | rỗng |
| `SNAPSHOT_BASE_DIR` | Thư mục lưu snapshot do MediaMTX ghi qua hook | `./snapshots` |

Biến `NEXT_PUBLIC_*` được inline vào bundle client lúc `next build`, nên thay đổi cần rebuild image.

## Reverse proxy

Đặt dashboard sau Nginx/Caddy giúp:
- Bật HTTPS tập trung.
- Hide MediaMTX Control API khỏi Internet — chỉ Next.js cần truy cập upstream.
- Áp dụng rate limit, basic auth nếu cần.

Ví dụ Nginx tối thiểu (lưu `nginx/nginx.conf` đã có cấu hình thực tế):

```
server {
  listen 443 ssl http2;
  server_name dashboard.example.com;
  ssl_certificate     /etc/letsencrypt/live/...fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/...privkey.pem;

  location / {
    proxy_pass http://dashboard:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
```

## HTTPS

- Dashboard tự nó **không terminate TLS**. Triển khai sau reverse proxy HTTPS hoặc dùng `caddy` automatic HTTPS.
- MediaMTX có TLS riêng cho từng protocol (`rtspsAddress`, `rtmpsAddress`, `webrtcEncryption`, `hlsEncryption`, …). Cấu hình trong tab Protocols.
- Control API có thể bật TLS qua MediaMTX config; khi đó update `MEDIAMTX_API_URL=https://...`.

## Grafana / Prometheus stack (tùy chọn)

Đã có sẵn provisioning trong `grafana/`. Bật stack:

```
docker compose -f docker-compose.prod.yml --profile observability up -d
```

(profile observability nếu được khai báo) hoặc bật service rời.

## Healthcheck

- Dashboard expose route `/` (Next.js); thêm probe `http://dashboard:3000/`.
- MediaMTX API: `GET /v3/config/global/get` cần auth — dùng probe nội bộ với credential hoặc dùng MediaMTX builtin healthcheck nếu phiên bản có.

## Kiểm tra tương thích MediaMTX version

- Dashboard được test với MediaMTX 1.5+. Cấu trúc OpenAPI tham chiếu trong `openapi.yaml`.
- Khi nâng cấp MediaMTX, đối chiếu các field mới với type `GlobalConf` / `PathConf` trong `lib/mediamtx-api.ts`.
- Nếu Control API trả 404 cho endpoint dashboard gọi, có thể version MediaMTX cũ hơn — kiểm tra phần Audit log để xem endpoint nào fail.

## Bảo mật trước khi production

Tab **Overview → Cảnh báo bảo mật** chạy heuristic. Trước go-live:

1. Đổi mật khẩu mặc định.
2. Bind API/metrics/pprof về `127.0.0.1` hoặc subnet nội bộ, expose qua reverse proxy có auth.
3. Bật TLS cho mọi protocol public.
4. Backup config (`Config → Export`) trước mỗi đợt thay đổi lớn.
