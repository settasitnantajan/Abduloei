'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, CheckCheck, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getUnreadCount, getNotifications, markAsRead, markAllAsRead } from '@/app/actions/notifications'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  event_id: string | null
  created_at: string
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'เมื่อสักครู่'
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} วันที่แล้ว`
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchCount = useCallback(async () => {
    const count = await getUnreadCount()
    setUnreadCount(count)
  }, [])

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [fetchCount])

  const handleOpen = async () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    setIsOpen(true)
    setLoading(true)
    const data = await getNotifications()
    setNotifications(data)
    setLoading(false)
  }

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id)
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
        title="แจ้งเตือน"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 md:bg-transparent"
              onClick={() => setIsOpen(false)}
            />

            {/* Desktop: dropdown | Mobile: bottom sheet */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="hidden md:block absolute right-0 md:left-full md:right-auto md:ml-2 top-0 z-50 w-80 max-h-96 bg-[#1A1A1A] border border-[#333333] rounded-lg shadow-xl overflow-hidden"
            >
              <NotificationContent
                notifications={notifications}
                loading={loading}
                unreadCount={unreadCount}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
              />
            </motion.div>

            {/* Mobile bottom sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-[#1A1A1A] border-t border-[#333333] rounded-t-2xl max-h-[80vh] overflow-hidden pb-safe"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#444444]" />
              </div>
              {/* Close button */}
              <div className="flex items-center justify-between px-4 pb-2">
                <h3 className="text-base font-semibold text-white">แจ้งเตือน</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[#2A2A2A] text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <NotificationContent
                notifications={notifications}
                loading={loading}
                unreadCount={unreadCount}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
                hideHeader
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function NotificationContent({
  notifications,
  loading,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  hideHeader = false,
}: {
  notifications: Notification[]
  loading: boolean
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  hideHeader?: boolean
}) {
  return (
    <>
      {/* Header (desktop only) */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333333]">
          <h3 className="text-sm font-semibold text-white">แจ้งเตือน</h3>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="flex items-center gap-1 text-xs text-[#00B900] hover:text-[#00D900] transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              อ่านทั้งหมด
            </button>
          )}
        </div>
      )}

      {/* Mark all as read (mobile, inside sheet) */}
      {hideHeader && unreadCount > 0 && (
        <div className="flex justify-end px-4 pb-2">
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 text-xs text-[#00B900] hover:text-[#00D900] transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            อ่านทั้งหมด
          </button>
        </div>
      )}

      {/* List */}
      <div className="overflow-y-auto max-h-80 md:max-h-80">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-[#00B900] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Bell className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">ไม่มีแจ้งเตือน</p>
          </div>
        ) : (
          notifications.map(notification => (
            <div
              key={notification.id}
              className={`flex items-start gap-3 px-4 py-3 border-b border-[#222] hover:bg-[#222] transition-colors cursor-pointer ${
                !notification.is_read ? 'bg-[#00B900]/5' : ''
              }`}
              onClick={() => !notification.is_read && onMarkAsRead(notification.id)}
            >
              <div className="flex-shrink-0 mt-1">
                {!notification.is_read ? (
                  <div className="w-2 h-2 rounded-full bg-[#00B900]" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-transparent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!notification.is_read ? 'text-white font-medium' : 'text-gray-400'}`}>
                  {notification.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {notification.message}
                </p>
                <p className="text-[10px] text-gray-600 mt-1">
                  {timeAgo(notification.created_at)}
                </p>
              </div>
              {!notification.is_read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onMarkAsRead(notification.id)
                  }}
                  className="flex-shrink-0 p-1 text-gray-500 hover:text-[#00B900] transition-colors"
                  title="อ่านแล้ว"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}
