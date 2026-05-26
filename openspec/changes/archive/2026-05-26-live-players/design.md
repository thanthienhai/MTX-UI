## Context

Dashboard MTX-UI hiện tại chỉ có HLS player (`components/stream-player.tsx`) dùng `hls.js`. Các URL cho WebRTC (WHEP/WHIP) đã được generate trong `lib/mediamtx-url.mjs` nhưng chưa có component player. Playback cho recording đã có trong `components/playback-view.tsx` (PlaybackBrowser) và được coi là hoàn thành. Chưa có multi-view hay snapshot.

Project là Next.js 15 App Router, React 19, TypeScript, Tailwind CSS. Single-page dashboard với tab navigation (shadcn/ui Tabs). All player components được render inline trong dashboard.

## Goals / Non-Goals

**Goals:**
- WebRTC player (WHEP) với `mediamtx-webrtc-react`, UI pattern giống HLS player
- Multi-view player: grid container 2×2/3×3, pin/mute/fullscreen controls, auto-select HLS hoặc WebRTC per cell
- Snapshot preview server-side: FFmpeg hook `runOnReady`, config UI, thumbnail, gallery
- Tab "Live Players" mới trong dashboard navigation

**Non-Goals:**
- Không thay đổi architecture hiện tại (vẫn là single-page tab-based)
- Không thêm backend API (dùng proxy MediaMTX hiện có)
- Không implement snapshot client-side (Canvas capture)
- Không thay đổi HLS player hiện tại
- Không implement multi-view drag-and-drop (phiên bản đầu)

## Decisions

### D1. WebRTC Player: `mediamtx-webrtc-react`
- **Decision**: Dùng thư viện `mediamtx-webrtc-react` thay vì tự implement RTCPeerConnection
- **Rationale**: 
  - Là TypeScript port của `reader.js` chính thức từ MediaMTX
  - Có sẵn hook `useMediaMTXWebRTC` quản lý toàn bộ lifecycle connection
  - Connection state: `getting_codecs | running | restarting | closed | failed`
  - Auto-retry, data channel support
- **Alternative considered**: `@eyevinn/webrtc-player` — mạnh hơn nhưng overkill cho use case chỉ connect 1 WHEP endpoint

### D2. Component Pattern: Copy StreamPlayer
- **Decision**: `WHEPPlayer` component sẽ follow đúng pattern của `StreamPlayer` (props, states, layout)
- **Rationale**: Consistency trong codebase — cùng interface `{ pathName: string }`, cùng 16:9 aspect ratio, cùng loading/error overlay pattern
- **Alternative**: Tạo abstract `BasePlayer` — over-engineering, chỉ 2 player types hiện tại

### D3. Multi-View Grid: CSS Grid thuần
- **Decision**: Dùng Tailwind CSS grid classes (giống pattern có sẵn trong codebase) thay vì thư viện grid layout
- **Rationale**: 
  - Codebase đã dùng `grid-cols-2`, `grid-cols-3` pattern
  - Không cần extra dependency
  - Responsive: `md:grid-cols-2 lg:grid-cols-3`
- **Layout states**: `2×2` → `grid-cols-1 md:grid-cols-2`, `3×3` → `grid-cols-1 md:grid-cols-3`

### D4. Pin Stream Layout
- **Decision**: Khi pin, stream được pinned chiếm `col-span-2 row-span-2`, các stream còn lại ở dưới
- **Rationale**: Layout surveillance-grid phổ biến, dễ implement với CSS grid `col-span-2`

### D5. Snapshot: Server-side qua Config
- **Decision**: Snapshot dùng MediaMTX hook `runOnReady` với FFmpeg command
- **Rationale**: Client-side Canvas capture chỉ cho frame đang play, không lưu được. Server-side cho phép lưu ảnh định kỳ độc lập với UI.
- **UI**: Config snapshot interval, output path, và command template trong Path Edit Dialog

### D6. Stream Selection cho Multi-View
- **Decision**: Tự động load tất cả live path vào grid, user có thể add/remove
- **Rationale**: Đơn giản nhất cho version 1. Version sau có thể thêm drag-drop

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| **WebRTC** không hoạt động nếu MediaMTX không cấu hình đúng ICE/STUN/TURN | Hiển thị warning trong UI khi WebRTC enabled nhưng không có ICE servers; fallback về HLS |
| `mediamtx-webrtc-react` là thư viện ít stars (⭐3) | Có thể fallback về tự implement WHEP với native RTCPeerConnection nếu library không ổn định |
| **Multi-View** performance với 9 stream cùng lúc | Chỉ load video khi cell visible; lazy load khi chuyển grid size; WebRTC giới hạn số connection |
| **Snapshot** FFmpeg dependency | Cảnh báo rõ trong UI: "Cần FFmpeg trên server" |
| **Memory** khi nhiều player instances | Dùng `useRef` để destroy instance khi unmount; cleanup trong `useEffect` return |
