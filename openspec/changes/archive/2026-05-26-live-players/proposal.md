## Why

Dashboard hiện tại mới chỉ hỗ trợ HLS player cho live stream. Người dùng cần thêm các tùy chọn xem stream khác: WebRTC (độ trễ thấp), multi-view (giám sát nhiều camera cùng lúc), và snapshot preview. Các tính năng này đã được xác định trong `todo.md` section 10 và 16 nhưng chưa được triển khai.

## What Changes

- **WebRTC Player (WHEP)**: Component player mới dùng giao thức WHEP (WebRTC HTML5 Embed Play) để xem stream với độ trễ thấp hơn HLS. Tích hợp vào path actions và path list preview.
- **Multi-View Player**: Grid container mới cho phép xem nhiều stream cùng lúc (2×2, 3×3) với các controls: pin stream, mute/unmute, fullscreen. Tab riêng trong dashboard.
- **Snapshot Preview**: UI cấu hình và quản lý snapshot server-side dùng FFmpeg hook `runOnReady`. Thumbnail trong path list, snapshot gallery.
- **Cập nhật Todo**: Đánh dấu Playback Player là hoàn thành (PlaybackBrowser đã đủ chức năng).

## Capabilities

### New Capabilities
- `webrtc-player-whep`: WebRTC/WHEP player component cho live stream latency thấp
- `multi-view-player`: Grid multi-stream với pin, mute, fullscreen controls
- `snapshot-preview`: Snapshot server-side qua FFmpeg hook, thumbnail và gallery

### Modified Capabilities
_(Không có — các spec hiện tại không thay đổi requirement)_

## Impact

- **New dependencies**: `mediamtx-webrtc-react` (WHEP client)
- **New components**: `components/whep-player.tsx`, `components/multi-view-player/*`, `components/snapshot-config.tsx`
- **Modified components**: `components/path-actions.tsx` (thêm WHEP preview), `app/page.tsx` (thêm tab Live Players)
- **New Tabs**: Thêm tab "Live Players" trong thanh điều hướng dashboard
- **Config changes**: MediaMTX cần bật WebRTC server (`webrtc: true`) và cấu hình ICE servers
