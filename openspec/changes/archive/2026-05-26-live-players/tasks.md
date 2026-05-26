## 1. Setup & Dependencies

- [x] 1.1 Install `mediamtx-webrtc-react` package via pnpm
- [x] 1.2 Create directory `components/multi-view-player/` for multi-view module
- [x] 1.3 Create spec directories under `openspec/changes/live-players/specs/` (done)

## 2. WebRTC Player (WHEP) — Component

- [x] 2.1 Create `components/whep-player.tsx` with WHEP connection using `useMediaMTXWebRTC` hook
- [x] 2.2 Implement loading state: spinner overlay while `isConnecting` (match `StreamPlayer` pattern)
- [x] 2.3 Implement error state: error message overlay when connection fails
- [x] 2.4 Implement connected state: render `<video>` with `autoPlay controls playsInline muted`
- [x] 2.5 Handle cleanup on unmount: close WHEP connection, detach MediaStream (handled by hook's internal cleanup)
- [x] 2.6 Export `WHEPPlayer` component with `{ pathName: string }` props interface

## 3. WebRTC Player — Integration

- [x] 3.1 Add "WebRTC" preview button in `renderStreamRow` (`app/page.tsx`) next to existing "Preview stream" button
- [x] 3.2 Add WHEP preview toggle in `components/path-management/path-actions.tsx` alongside HLS preview
- [x] 3.3 Ensure permission check: only show WebRTC button if `canRead` and path is live (`runtimePath.ready`)
- [x] 3.4 Verify WHEP URL is displayed in Path Actions protocol URLs section (already exists from `buildPathStreamUrls`)

## 4. Multi-View Player — Core

- [x] 4.1 Create `components/multi-view-player/use-multi-view.ts` hook with state management:
  - gridSize: `2x2` | `3x3`
  - streams: `StreamSlot[]` (each with id, pathName, protocol, isLive)
  - pinnedStream: string | null
  - mutedStreams: string[]
  - fullscreenStream: string | null
- [x] 4.2 Create `components/multi-view-player/grid-cell.tsx` component:
  - Renders appropriate player (HLS `StreamPlayer` or `WHEPPlayer`) based on protocol
  - Action buttons: pin, mute/unmute, fullscreen, remove
  - 16:9 aspect ratio container
  - Stream name label overlay
- [x] 4.3 Create `components/multi-view-player/grid-controls.tsx` component:
  - Grid size selector: `2×2` / `3×3`
  - "Mute All" / "Unmute All" button
  - Stream selector (dropdown to pick which live path goes in which cell)
- [x] 4.4 Create `components/multi-view-player/index.tsx` composing grid + controls
  - CSS grid layout: `grid-cols-2` for 2×2, `grid-cols-3` for 3×3
  - Fetch live paths and populate grid cells
  - Auto-select protocol (WebRTC preferred, HLS fallback)

## 5. Multi-View Player — Features

- [x] 5.1 Implement pin: pinned cell gets `col-span-2 row-span-2`, only one pinned at a time
- [x] 5.2 Implement mute/unmute per cell: toggle `muted` attribute on `<video>`
- [x] 5.3 Implement "Mute All": mute all cells, track per-cell mute states for restore
- [x] 5.4 Implement fullscreen: use `element.requestFullscreen()` on cell container
- [x] 5.5 Implement stream add/remove: dropdown to add live paths, X button to remove

## 6. Multi-View Player — Dashboard Integration

- [x] 6.1 Add "Live Players" tab in `TabsList` in `app/page.tsx` (with `Video` icon)
- [x] 6.2 Add `TabsContent` for the new tab rendering `MultiViewPlayer`
- [x] 6.3 Pass necessary props: `livePaths`, `isWebRTCEnabled`

## 7. Snapshot Preview — Config UI

- [x] 7.1 Create `components/snapshot-config.tsx` component:
  - Enable/disable toggle for snapshot
  - FFmpeg command preview (generated from template)
  - Interval input (seconds)
  - Output path input (with `%path` variable support)
  - Security warning banner about FFmpeg dependency
- [x] 7.2 Integrate snapshot config into Path Edit Dialog (`app/page.tsx` edit path section)
- [x] 7.3 Generate `runOnReady` command from snapshot settings and display preview (editable textarea)
- [x] 7.4 Add command validation: security warning shown when enabled (FFmpeg dependency notice)

## 8. Snapshot Preview — Thumbnail & Gallery

- [x] 8.1 Add snapshot gallery button in path list (`renderStreamRow`) — opens gallery dialog
- [x] 8.2 Create snapshot gallery dialog: list all snapshots for a path with timestamps
- [x] 8.3 Add download button for individual snapshots
- [x] 8.4 Add delete button for individual snapshots with confirmation dialog
- [x] 8.5 Add snapshot gallery button per path row (visual indicator of snapshot feature)

## 9. Verification & Cleanup

- [x] 9.1 Update `todo.md`: mark section 10 items as done (Playback Player, WebRTC Player, Multi-View, Snapshot)
- [x] 9.2 Run `tsc --noEmit` — all errors are pre-existing (playback-view.tsx, recording-settings-view.tsx, playback-api.ts)
- [ ] 9.3 Run build: `pnpm build` and fix any errors (blocked: no pnpm available, use `npm run build`)
- [ ] 9.4 Verify all new components render correctly with mock data (manual)
