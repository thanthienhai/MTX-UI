## 1. ProxyConfig Component

- [x] 1.1 Create `components/proxy-config.tsx` with type definitions for proxy templates
- [x] 1.2 Define proxy template presets: RTSP Camera/Server, RTSPS (TLS), HLS Upstream, RTMP Upstream, SRT Upstream
- [x] 1.3 Implement template selector with protocol-specific form fields (host, port, username, password, path, stream ID)
- [x] 1.4 Implement source URL generator from template parameters
- [x] 1.5 Add live source URL preview (read-only display, updates on field change)
- [x] 1.6 Add manual URL override mode toggle
- [x] 1.7 Add `sourceOnDemand` toggle with timing config fields (`startTimeout`, `closeAfter`)
- [x] 1.8 Add `sourceFingerprint` field (shown for RTSPS template)
- [x] 1.9 Add validation for URL format per protocol
- [x] 1.10 Add "Test upstream source" button with:
  - URL format validation
  - HTTP fetch probe for HTTP/HLS sources
  - ffprobe suggestion for RTSP/RTMP/SRT sources
- [x] 1.11 Export `ProxyConfig` component with controlled props pattern

## 2. Regex Capture Groups Helper

- [x] 2.1 Create `components/proxy-regex-helper.tsx` component
- [x] 2.2 Detect regex path name (`~` prefix) and parse capture group count
- [x] 2.3 Display available capture group variables: `$G1`, `$G2`, etc.
- [x] 2.4 Implement "insert at cursor" buttons for each capture group
- [x] 2.5 Add resolved URL preview with example capture group values
- [x] 2.6 Integrate into `ProxyConfig` component (shown when path name is regex)

## 3. Proxy Tab in Dashboard

- [x] 3.1 Add `Globe` (or `Share2`) icon import in `app/page.tsx`
- [x] 3.2 Add `<TabsTrigger value="proxy">` in TabsList with icon and label "Proxy"
- [x] 3.3 Update `lg:grid-cols-9` to `lg:grid-cols-10` in TabsList className
- [x] 3.4 Add `<TabsContent value="proxy">` section with:
  - Proxy path list (filtered from `paths` where `source` is an upstream URL)
  - Add Proxy Path button opening ProxyConfig dialog
  - Edit/Delete actions per proxy path
  - Runtime status (live/idle) from `livePaths`
  - Empty state when no proxy paths exist
- [x] 3.5 Implement proxy path filtering utility (detect upstream source URLs)

## 4. Path Form Integration

- [x] 4.1 Import `ProxyConfig` in `components/path-management/path-form.tsx`
- [x] 4.2 Add "Proxy" collapsible section in the source configuration area
- [x] 4.3 Sync `source` state between proxy config and form source field
- [x] 4.4 Sync `sourceOnDemand` state between proxy config and form
- [x] 4.5 Sync `sourceFingerprint` state for TLS sources
- [x] 4.6 Load proxy state from `initialPath` when editing

## 5. Verify & Finalize

- [x] 5.1 Run `lsp_diagnostics` on all modified files — no new errors
- [x] 5.2 Build project with `pnpm build` — no errors
- [x] 5.3 Review implementation against spec requirements for completeness
