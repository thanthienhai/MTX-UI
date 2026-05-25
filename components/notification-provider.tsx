"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

type NotificationType = "success" | "error" | "info"

interface Notification {
  id: number
  type: NotificationType
  title: string
  message?: string
}

interface NotificationContextValue {
  notify: (notification: Omit<Notification, "id">) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const notify = useCallback((notification: Omit<Notification, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setNotifications((current) => [...current, { id, ...notification }].slice(-5))
    window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id))
    }, 4500)
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-lg border bg-white p-4 shadow-lg ${
              notification.type === "success"
                ? "border-[#05b169]/30"
                : notification.type === "error"
                  ? "border-[#cf202f]/30"
                  : "border-[#0052ff]/30"
            }`}
            role="status"
          >
            <div className="text-sm font-semibold text-[#0a0b0d]">{notification.title}</div>
            {notification.message && <div className="mt-1 text-sm text-[#5b616e]">{notification.message}</div>}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error("useNotifications must be used within NotificationProvider")
  return context
}

