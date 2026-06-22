"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import { LOGO_SRC } from "@/lib/branding"
import { setDashboardSession, type DashboardCredentialMode } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [credentialMode, setCredentialMode] = useState<DashboardCredentialMode>("basic")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialMode, username, password, token }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Lỗi máy chủ." }))
        throw new Error(data.error || `Máy chủ trả về mã ${res.status}`)
      }

      const data = await res.json()
      setDashboardSession({
        username: data.username || username,
        permissions: data.permissions || {},
        credentialMode,
      })
      router.push("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kết nối MediaMTX hoặc xác thực thông tin đã nhập.")
      console.error("Login error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <img src={LOGO_SRC} alt="SIPVY" className="h-12 w-auto mb-4" />
          <CardTitle className="text-2xl font-bold text-center">Bảng điều khiển MediaMTX</CardTitle>
          <CardDescription className="text-center">Đăng nhập để quản trị máy chủ streaming</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credentialMode">Kiểu xác thực</Label>
              <Select value={credentialMode} onValueChange={(value) => setCredentialMode(value as DashboardCredentialMode)}>
                <SelectTrigger id="credentialMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="bearer">Token / JWT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Tên người dùng</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={credentialMode === "basic"}
                disabled={credentialMode === "bearer"}
                autoComplete="username"
              />
            </div>

            {credentialMode === "basic" ? (
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="token">Token / JWT</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Dán bearer token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Thông tin mặc định:</p>
            <p className="font-mono text-xs mt-1">
              Tên người dùng: <span className="font-semibold">admin</span> | Mật khẩu:{" "}
              <span className="font-semibold">adminpass</span>
            </p>
            <p className="mt-2 text-xs">Chế độ Token/JWT gửi thông tin xác thực dưới dạng bearer token.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
