"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, AlertTriangle, Info } from "lucide-react"

const RECEIVE_PROTOCOLS = ["HLS", "RTSP", "WebRTC", "Raspberry Pi Camera"]
const SEND_PROTOCOLS = ["HLS", "RTSP", "WebRTC"]

interface AbsoluteTimestampsInfoProps {
  /** If supplied, render a small inline warning when the source protocol lacks absolute timestamp support. */
  sourceProtocol?: string | null
  useAbsoluteTimestamp?: boolean
  compact?: boolean
}

function sourceSupportsAbsTs(protocol: string | null | undefined): boolean | null {
  if (!protocol) return null
  const p = protocol.toLowerCase()
  if (p.includes("hls") || p.includes("rtsp") || p.includes("webrtc") || p.includes("rpicamera")) return true
  if (p.includes("rtmp") || p.includes("srt") || p.includes("mpegts") || p.includes("rtp")) return false
  return null
}

export function AbsoluteTimestampsInfo({ sourceProtocol, useAbsoluteTimestamp, compact }: AbsoluteTimestampsInfoProps) {
  const supports = sourceSupportsAbsTs(sourceProtocol)

  if (compact) {
    if (!useAbsoluteTimestamp) return null
    if (supports === false) {
      return (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          <span>
            Source protocol <strong>{sourceProtocol}</strong> không truyền absolute timestamps. useAbsoluteTimestamp sẽ
            không có hiệu lực — segment sẽ dùng thời gian khi MediaMTX nhận packet.
          </span>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Absolute Timestamps
        </CardTitle>
        <CardDescription>
          Khi bật <code className="rounded bg-muted px-1 text-xs">useAbsoluteTimestamp</code>, MediaMTX dùng thời điểm
          gốc của video thay vì thời gian khi nhận packet. Hữu ích cho recording chính xác theo ngày giờ và đồng bộ
          giữa nhiều stream.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
          <Info className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
          <div>
            <p>Recording date sẽ phản ánh đúng wallclock của camera. Đồng bộ multi-stream chỉ chính xác nếu mọi nguồn
              đều dùng cùng đồng hồ NTP.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Receive (source)</div>
            <div className="flex flex-wrap gap-1">
              {RECEIVE_PROTOCOLS.map((p) => (
                <Badge key={p} variant="outline" className="text-xs">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Send (reader)</div>
            <div className="flex flex-wrap gap-1">
              {SEND_PROTOCOLS.map((p) => (
                <Badge key={p} variant="outline" className="text-xs">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {sourceProtocol && supports === false && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
            <span>
              Source protocol hiện tại (<strong>{sourceProtocol}</strong>) không truyền absolute timestamps.
              useAbsoluteTimestamp sẽ không có hiệu lực với path này.
            </span>
          </div>
        )}
        {sourceProtocol && supports === true && (
          <div className="text-xs text-emerald-700">
            Source protocol <strong>{sourceProtocol}</strong> có hỗ trợ absolute timestamps.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AbsoluteTimestampsInfo
