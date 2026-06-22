"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, BookOpen } from "lucide-react"
import { copyToClipboard } from "@/lib/clipboard"
import { useNotifications } from "@/components/notification-provider"
import {
  buildMediaMtxHlsUrl,
  buildMediaMtxWebRtcReadUrl,
  buildMediaMtxWebRtcPublishUrl,
  buildMediaMtxProtocolUrl,
} from "@/lib/mediamtx-url.mjs"

interface GuidesViewProps {
  pathSuggestions?: string[]
}

interface Snippet {
  label: string
  language: "bash" | "text" | "python" | "go" | "csharp"
  code: string
  note?: string
}

interface Guide {
  id: string
  title: string
  description: string
  snippets: (ctx: GuideCtx) => Snippet[]
}

interface GuideCtx {
  path: string
  host: string
  rtspPort: string
  rtmpPort: string
  hlsPort: string
  webrtcPort: string
  srtPort: string
  rtpPort: string
  publishUser?: string
  publishPass?: string
  protocol: string
}

function withCreds(url: string, user?: string, pass?: string) {
  if (!user) return url
  const i = url.indexOf("://")
  if (i < 0) return url
  const enc = encodeURIComponent(user) + (pass ? `:${encodeURIComponent(pass)}` : "")
  return `${url.slice(0, i + 3)}${enc}@${url.slice(i + 3)}`
}

function rtspUrl(ctx: GuideCtx, withAuth = false) {
  const base = `rtsp://${ctx.host}:${ctx.rtspPort}/${encodeURIComponent(ctx.path)}`
  return withAuth ? withCreds(base, ctx.publishUser, ctx.publishPass) : base
}

function rtmpUrl(ctx: GuideCtx, withAuth = false) {
  const base = `rtmp://${ctx.host}:${ctx.rtmpPort}/${encodeURIComponent(ctx.path)}`
  return withAuth ? withCreds(base, ctx.publishUser, ctx.publishPass) : base
}

function hlsUrl(ctx: GuideCtx) {
  return `${ctx.protocol}//${ctx.host}:${ctx.hlsPort}/${encodeURIComponent(ctx.path)}/index.m3u8`
}

function whepUrl(ctx: GuideCtx) {
  return `${ctx.protocol}//${ctx.host}:${ctx.webrtcPort}/${encodeURIComponent(ctx.path)}/whep`
}

function whipUrl(ctx: GuideCtx) {
  return `${ctx.protocol}//${ctx.host}:${ctx.webrtcPort}/${encodeURIComponent(ctx.path)}/whip`
}

function srtUrl(ctx: GuideCtx, mode: "publish" | "read") {
  const sid = `${mode}:${ctx.path}`
  return `srt://${ctx.host}:${ctx.srtPort}?streamid=${encodeURIComponent(sid)}`
}

// ── PUBLISH GUIDES ────────────────────────────────────────────────────────────

const PUBLISH_GUIDES: Guide[] = [
  {
    id: "ffmpeg",
    title: "FFmpeg",
    description: "Stream từ file hoặc thiết bị bằng FFmpeg sang MediaMTX.",
    snippets: (ctx) => [
      {
        label: "Publish file MP4 vòng lặp qua RTSP",
        language: "bash",
        code: `ffmpeg -re -stream_loop -1 -i input.mp4 -c copy -f rtsp ${rtspUrl(ctx, true)}`,
      },
      {
        label: "Publish webcam qua RTMP",
        language: "bash",
        code: `ffmpeg -f v4l2 -i /dev/video0 -c:v libx264 -preset veryfast -tune zerolatency -f flv ${rtmpUrl(ctx, true)}`,
      },
      {
        label: "Publish desktop screen qua RTSP",
        language: "bash",
        code: `ffmpeg -f x11grab -i :0.0 -c:v libx264 -preset veryfast -tune zerolatency -f rtsp ${rtspUrl(ctx, true)}`,
      },
    ],
  },
  {
    id: "gstreamer",
    title: "GStreamer",
    description: "Stream bằng GStreamer pipeline.",
    snippets: (ctx) => [
      {
        label: "Publish testsrc qua RTSP",
        language: "bash",
        code: `gst-launch-1.0 videotestsrc ! videoconvert ! x264enc tune=zerolatency ! rtspclientsink location=${rtspUrl(ctx, true)}`,
      },
      {
        label: "Publish webcam qua RTSP",
        language: "bash",
        code: `gst-launch-1.0 v4l2src device=/dev/video0 ! videoconvert ! x264enc tune=zerolatency ! rtspclientsink location=${rtspUrl(ctx, true)}`,
      },
    ],
  },
  {
    id: "obs",
    title: "OBS Studio",
    description: "Cấu hình OBS để stream qua RTMP.",
    snippets: (ctx) => [
      {
        label: "Settings → Stream",
        language: "text",
        code: `Service: Custom...
Server:  rtmp://${ctx.host}:${ctx.rtmpPort}/
Stream Key: ${ctx.path}${ctx.publishUser ? `?user=${ctx.publishUser}&pass=${ctx.publishPass ?? ""}` : ""}`,
        note: "Hoặc dùng WHIP output (OBS 30+): URL = " + whipUrl(ctx),
      },
    ],
  },
  {
    id: "browser-whip",
    title: "Browser (WHIP)",
    description: "Publish trực tiếp từ trình duyệt qua WebRTC/WHIP.",
    snippets: (ctx) => [
      {
        label: "WHIP endpoint",
        language: "text",
        code: whipUrl(ctx),
        note: "Dùng client WHIP (e.g. wish, OBS, GStreamer whipclientsink) trỏ tới URL trên.",
      },
    ],
  },
  {
    id: "python",
    title: "Python (OpenCV / FFmpeg-python)",
    description: "Snippet Python publish stream.",
    snippets: (ctx) => [
      {
        label: "FFmpeg-python publish camera",
        language: "python",
        code: `import ffmpeg
(
    ffmpeg
    .input("/dev/video0", format="v4l2")
    .output("${rtspUrl(ctx, true)}", vcodec="libx264", preset="veryfast", tune="zerolatency", f="rtsp")
    .run()
)`,
      },
    ],
  },
  {
    id: "golang",
    title: "Golang (gortsplib)",
    description: "Snippet Go publish RTSP.",
    snippets: (ctx) => [
      {
        label: "RTSP publish skeleton",
        language: "go",
        code: `// xem https://github.com/bluenviron/gortsplib
// publisher.Publish(ctx, "${rtspUrl(ctx, true)}", session)`,
      },
    ],
  },
  {
    id: "unity",
    title: "Unity",
    description: "Plugin RTSP/RTMP cho Unity (vd. AVPro).",
    snippets: (ctx) => [
      {
        label: "Endpoint cấu hình plugin",
        language: "text",
        code: `${rtspUrl(ctx, true)}\n${rtmpUrl(ctx, true)}`,
      },
    ],
  },
  {
    id: "rpi",
    title: "Raspberry Pi Camera",
    description: "Dùng source rpiCamera trực tiếp trong path config (Path Edit → Source).",
    snippets: (ctx) => [
      {
        label: "Path YAML",
        language: "text",
        code: `paths:
  ${ctx.path}:
    source: rpiCamera
    rpiCameraWidth: 1920
    rpiCameraHeight: 1080
    rpiCameraFPS: 30`,
      },
    ],
  },
  {
    id: "rtsp-camera",
    title: "RTSP camera/server (pull)",
    description: "Cấu hình path source là RTSP URL upstream.",
    snippets: (ctx) => [
      {
        label: "Path YAML",
        language: "text",
        code: `paths:
  ${ctx.path}:
    source: rtsp://user:pass@camera-host/stream
    sourceOnDemand: yes`,
      },
    ],
  },
  {
    id: "hls-camera",
    title: "HLS camera/server (pull)",
    description: "Pull stream từ một HLS server upstream làm source cho path.",
    snippets: (ctx) => [
      {
        label: "Path YAML",
        language: "text",
        code: `paths:
  ${ctx.path}:
    source: https://upstream-host/stream/index.m3u8
    sourceFingerprint: ""    # tuỳ chọn: SHA256 cert nếu HTTPS self-signed
    sourceOnDemand: yes`,
        note: "MediaMTX hỗ trợ HLS source (HLS → republish sang RTSP/RTMP/WebRTC/SRT). Dùng URL `.m3u8`.",
      },
      {
        label: "FFmpeg → relay HLS lên RTSP path",
        language: "bash",
        code: `ffmpeg -re -i https://upstream-host/stream/index.m3u8 -c copy -f rtsp ${rtspUrl(ctx, true)}`,
        note: "Phương án thay thế nếu version MediaMTX không hỗ trợ source HLS trực tiếp.",
      },
    ],
  },
  {
    id: "vlc",
    title: "VLC (stream out)",
    description: "Publish file/capture từ VLC bằng tính năng Stream...",
    snippets: (ctx) => [
      {
        label: "Stream sang RTMP (Media → Stream...)",
        language: "text",
        code: `Destination: RTMP
URL:    ${rtmpUrl(ctx, true)}
Profile: Video - H.264 + MP3 (MP4)`,
        note: "VLC: Media → Stream... → chọn file/capture → Next → New destination = RTMP → dán URL.",
      },
      {
        label: "Stream sang RTP/MPEG-TS (CLI)",
        language: "bash",
        code: `vlc -vvv input.mp4 --sout "#std{access=udp,mux=ts,dst=${ctx.host}:${ctx.rtpPort}}"`,
        note: "Bind path MediaMTX với source `rtp://:${ctx.rtpPort}` hoặc dùng `udp://@:${ctx.rtpPort}` thông qua FFmpeg trung gian.",
      },
      {
        label: "Stream sang RTSP (chế độ server VLC)",
        language: "bash",
        code: `vlc -vvv input.mp4 --sout "#rtp{sdp=rtsp://:8554/${ctx.path}}" :sout-keep`,
        note: "VLC tự host RTSP — MediaMTX có thể pull về bằng path source `rtsp://vlc-host:8554/${ctx.path}`.",
      },
    ],
  },
  {
    id: "srt",
    title: "SRT client",
    description: "Publish qua SRT.",
    snippets: (ctx) => [
      {
        label: "FFmpeg → SRT publish",
        language: "bash",
        code: `ffmpeg -re -i input.mp4 -c copy -f mpegts "${srtUrl(ctx, "publish")}"`,
      },
    ],
  },
  {
    id: "rtp-mpegts",
    title: "RTP / MPEG-TS",
    description: "Publish bằng cách bind path source vào RTP/UDP MPEG-TS.",
    snippets: (ctx) => [
      {
        label: "Path YAML (RTP)",
        language: "text",
        code: `paths:
  ${ctx.path}:
    source: rtp://:${ctx.rtpPort}
    rtpSDP: |
      v=0
      ...`,
      },
      {
        label: "FFmpeg → MPEG-TS over UDP",
        language: "bash",
        code: `ffmpeg -re -i input.mp4 -c copy -f mpegts udp://${ctx.host}:${ctx.rtpPort}`,
      },
    ],
  },
]

// ── READ GUIDES ──────────────────────────────────────────────────────────────

const READ_GUIDES: Guide[] = [
  {
    id: "urls",
    title: "Stream URLs (mọi protocol)",
    description: "Sao chép URL cho client tuỳ ý.",
    snippets: (ctx) => [
      { label: "RTSP", language: "text", code: rtspUrl(ctx) },
      { label: "RTMP", language: "text", code: rtmpUrl(ctx) },
      { label: "HLS", language: "text", code: hlsUrl(ctx) },
      { label: "WebRTC (WHEP)", language: "text", code: whepUrl(ctx) },
      { label: "SRT", language: "text", code: srtUrl(ctx, "read") },
    ],
  },
  {
    id: "ffmpeg",
    title: "FFmpeg",
    description: "Đọc stream và lưu/forward bằng FFmpeg.",
    snippets: (ctx) => [
      { label: "Save RTSP → MP4", language: "bash", code: `ffmpeg -i ${rtspUrl(ctx)} -c copy out.mp4` },
      { label: "Save HLS → MP4", language: "bash", code: `ffmpeg -i ${hlsUrl(ctx)} -c copy out.mp4` },
      { label: "Play SRT", language: "bash", code: `ffplay "${srtUrl(ctx, "read")}"` },
    ],
  },
  {
    id: "gstreamer",
    title: "GStreamer",
    description: "Pipeline GStreamer phát lại.",
    snippets: (ctx) => [
      { label: "RTSP playback", language: "bash", code: `gst-launch-1.0 rtspsrc location=${rtspUrl(ctx)} ! decodebin ! autovideosink` },
    ],
  },
  {
    id: "vlc",
    title: "VLC",
    description: "Mở stream trong VLC (Media → Open Network Stream).",
    snippets: (ctx) => [
      { label: "RTSP", language: "text", code: rtspUrl(ctx) },
      { label: "HLS", language: "text", code: hlsUrl(ctx) },
      { label: "RTMP", language: "text", code: rtmpUrl(ctx) },
    ],
  },
  {
    id: "obs",
    title: "OBS Studio",
    description: "Thêm Media Source dùng URL.",
    snippets: (ctx) => [
      { label: "Media Source → Input", language: "text", code: rtspUrl(ctx), note: "Tắt 'Local file', dán URL vào 'Input'." },
    ],
  },
  {
    id: "browser",
    title: "Trình duyệt (HLS / WebRTC)",
    description: "Dùng tag <video> hoặc client WHEP.",
    snippets: (ctx) => [
      { label: "HLS URL", language: "text", code: hlsUrl(ctx) },
      { label: "WHEP URL", language: "text", code: whepUrl(ctx) },
      {
        label: "HTML video tag (HLS qua hls.js)",
        language: "text",
        code: `<video id="v" controls></video>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
  const hls = new Hls()
  hls.loadSource("${hlsUrl(ctx)}")
  hls.attachMedia(document.getElementById("v"))
</script>`,
      },
    ],
  },
  {
    id: "python",
    title: "Python (OpenCV)",
    description: "Đọc frame bằng OpenCV.",
    snippets: (ctx) => [
      {
        label: "cv2.VideoCapture",
        language: "python",
        code: `import cv2
cap = cv2.VideoCapture("${rtspUrl(ctx)}")
while cap.isOpened():
    ok, frame = cap.read()
    if not ok: break
    # process frame`,
      },
    ],
  },
  {
    id: "golang",
    title: "Golang",
    description: "Đọc RTSP bằng gortsplib.",
    snippets: (ctx) => [
      {
        label: "gortsplib reader",
        language: "go",
        code: `// xem https://github.com/bluenviron/gortsplib
// reader.Read(ctx, "${rtspUrl(ctx)}", handler)`,
      },
    ],
  },
  {
    id: "unity",
    title: "Unity",
    description: "Dán URL vào plugin RTSP/HLS.",
    snippets: (ctx) => [{ label: "URL", language: "text", code: rtspUrl(ctx) }],
  },
]

// ── COMPONENT ────────────────────────────────────────────────────────────────

export function GuidesView({ pathSuggestions = [] }: GuidesViewProps) {
  const { notify } = useNotifications()
  const [path, setPath] = useState<string>(pathSuggestions[0] || "stream")
  const [host, setHost] = useState("localhost")
  const [rtspPort, setRtspPort] = useState("8554")
  const [rtmpPort, setRtmpPort] = useState("1935")
  const [hlsPort, setHlsPort] = useState("8888")
  const [webrtcPort, setWebrtcPort] = useState("8889")
  const [srtPort, setSrtPort] = useState("8890")
  const [rtpPort, setRtpPort] = useState("8000")
  const [publishUser, setPublishUser] = useState("")
  const [publishPass, setPublishPass] = useState("")

  const ctx: GuideCtx = useMemo(
    () => ({ path: path.trim() || "stream", host, rtspPort, rtmpPort, hlsPort, webrtcPort, srtPort, rtpPort, publishUser: publishUser || undefined, publishPass: publishPass || undefined, protocol: typeof window !== "undefined" ? window.location.protocol : "http:" }),
    [path, host, rtspPort, rtmpPort, hlsPort, webrtcPort, srtPort, rtpPort, publishUser, publishPass],
  )

  async function copy(code: string) {
    const ok = await copyToClipboard(code)
    if (ok) {
      notify({ type: "success", title: "Đã sao chép" })
    } else {
      notify({ type: "error", title: "Không sao chép được", message: "Trình duyệt từ chối clipboard." })
    }
  }

  function renderGuide(guide: Guide) {
    return (
      <Card key={guide.id}>
        <CardHeader>
          <CardTitle className="text-base">{guide.title}</CardTitle>
          <CardDescription>{guide.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {guide.snippets(ctx).map((s, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">{s.label}</Label>
                <Button size="sm" variant="ghost" onClick={() => copy(s.code)}>
                  <Copy className="mr-1 h-3 w-3" /> Copy
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-xs leading-relaxed">
                <code>{s.code}</code>
              </pre>
              {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" /> Tham số chung
          </CardTitle>
          <CardDescription>Các tham số bên dưới được áp dụng cho tất cả snippet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Path</Label>
              {pathSuggestions.length > 0 ? (
                <Select value={path} onValueChange={setPath}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pathSuggestions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={path} onChange={(e) => setPath(e.target.value)} className="h-8 text-xs" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Host</Label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RTSP port</Label>
              <Input value={rtspPort} onChange={(e) => setRtspPort(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RTMP port</Label>
              <Input value={rtmpPort} onChange={(e) => setRtmpPort(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">HLS port</Label>
              <Input value={hlsPort} onChange={(e) => setHlsPort(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">WebRTC port</Label>
              <Input value={webrtcPort} onChange={(e) => setWebrtcPort(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SRT port</Label>
              <Input value={srtPort} onChange={(e) => setSrtPort(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RTP port</Label>
              <Input value={rtpPort} onChange={(e) => setRtpPort(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Publish user (opt.)</Label>
              <Input value={publishUser} onChange={(e) => setPublishUser(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Publish pass (opt.)</Label>
              <Input
                type="password"
                value={publishPass}
                onChange={(e) => setPublishPass(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="publish">
        <TabsList>
          <TabsTrigger value="publish">Publish</TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>
        <TabsContent value="publish" className="mt-4 space-y-4">
          {PUBLISH_GUIDES.map(renderGuide)}
        </TabsContent>
        <TabsContent value="read" className="mt-4 space-y-4">
          {READ_GUIDES.map(renderGuide)}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default GuidesView
