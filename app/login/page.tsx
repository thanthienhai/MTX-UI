"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Radio, AlertCircle } from "lucide-react"
import {
  DashboardLoginError,
  setDashboardSession,
  validateMediaMtxLogin,
  type DashboardCredentialMode,
} from "@/lib/auth"

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
      const { session } = await validateMediaMtxLogin({
        credentialMode,
        username,
        password,
        token,
      })
      setDashboardSession(session)
      router.push("/")
    } catch (err) {
      setError(
        err instanceof DashboardLoginError
          ? err.userMessage
          : "Failed to connect to MediaMTX or validate the provided credentials.",
      )
      console.error("Login error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-lg mb-4">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">MediaMTX Dashboard</CardTitle>
          <CardDescription className="text-center">Sign in to manage your media streaming server</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credentialMode">Credential type</Label>
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
              <Label htmlFor="username">Username</Label>
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
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
                  placeholder="Paste bearer token"
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
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Default credentials:</p>
            <p className="font-mono text-xs mt-1">
              Username: <span className="font-semibold">admin</span> | Password:{" "}
              <span className="font-semibold">adminpass</span>
            </p>
            <p className="mt-2 text-xs">Token/JWT mode sends the credential as a bearer token.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
