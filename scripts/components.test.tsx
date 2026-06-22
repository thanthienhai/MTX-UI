import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { RecordingTimer } from "@/components/recording-timer"
import { StatusPill } from "@/components/status-pill"

describe("RecordingTimer", () => {
  it("renders elapsed time since startedAt", () => {
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString()
    render(<RecordingTimer startedAt={fiveSecondsAgo} />)
    const el = screen.getByText(/00:0[5-9]/)
    expect(el).toBeInTheDocument()
  })

  it("accepts a custom className", () => {
    const now = new Date().toISOString()
    const { container } = render(<RecordingTimer startedAt={now} className="text-red-500" />)
    expect(container.firstChild).toHaveClass("text-red-500")
  })
})

describe("StatusPill", () => {
  it("renders online state with green style", () => {
    render(<StatusPill on={true} />)
    const el = screen.getByText("Online")
    expect(el).toBeInTheDocument()
    expect(el.className).toContain("bg-[#05b169]")
  })

  it("renders offline state with gray style", () => {
    render(<StatusPill on={false} />)
    const el = screen.getByText("Offline")
    expect(el).toBeInTheDocument()
    expect(el.className).toContain("bg-[#eef0f3]")
  })

  it("supports custom labels", () => {
    render(<StatusPill on={true} labelOn="Đang ghi" labelOff="Tắt" />)
    expect(screen.getByText("Đang ghi")).toBeInTheDocument()
  })

  it("renders a status dot indicator", () => {
    const { container } = render(<StatusPill on={true} />)
    const dots = container.querySelectorAll("span.h-2.w-2")
    expect(dots.length).toBeGreaterThan(0)
  })
})
