import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-[#dee1e6] p-8 text-center">
      <Loader2 className="mb-3 h-7 w-7 animate-spin text-[#0052ff]" />
      <p className="text-sm text-[#5b616e]">{label}</p>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  action,
}: {
  icon?: React.ReactNode
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-[#dee1e6] p-8 text-center text-[#5b616e]">
      {icon}
      <p className="mt-2 text-sm font-medium">{title}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = "Unable to load data",
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-[#cf202f]/30 bg-[#cf202f]/5 p-8 text-center">
      <AlertCircle className="mb-3 h-7 w-7 text-[#cf202f]" />
      <p className="text-sm font-semibold text-[#0a0b0d]">{title}</p>
      {message && <p className="mt-1 text-sm text-[#5b616e]">{message}</p>}
      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

