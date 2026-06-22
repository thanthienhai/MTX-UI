interface StatusPillProps {
  on: boolean
  labelOn?: string
  labelOff?: string
}

export function StatusPill({ on, labelOn = "Online", labelOff = "Offline" }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        on ? "bg-[#05b169] text-white" : "bg-[#eef0f3] text-[#5b616e]"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-white" : "bg-[#9aa0a6]"}`} />
      {on ? labelOn : labelOff}
    </span>
  )
}
