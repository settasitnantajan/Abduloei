'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { generateLinkingCode, getLinkingStatus, unlinkLine, getLinkedCount, checkCodeUsed } from '@/app/actions/line-linking'
import { CheckCircle2, LinkIcon, Unlink, Loader2, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

interface LineAccount {
  id: string
  lineUserId: string
}

export default function LineLinkingCard() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'linking'>('loading')
  const [accounts, setAccounts] = useState<LineAccount[]>([])
  const [code, setCode] = useState('')
  const [expiresIn, setExpiresIn] = useState(0)
  const [error, setError] = useState('')
  const [linkedCount, setLinkedCount] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const checkStatus = useCallback(() => {
    startTransition(async () => {
      const result = await getLinkingStatus()
      setAccounts(result.accounts)
      if (status === 'linking' && result.accounts.length > accounts.length) {
        // ผูกสำเร็จแล้ว หยุด linking mode
        setStatus('ready')
        setCode('')
      } else if (status === 'loading') {
        setStatus('ready')
      }
    })
  }, [status, accounts.length])

  // เช็คสถานะตอนเปิดหน้า
  useEffect(() => {
    checkStatus()
    getLinkedCount().then(setLinkedCount)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling ทุก 3 วินาทีตอนกำลัง link — เช็คว่า code ถูกใช้แล้วหรือยัง
  useEffect(() => {
    if (status !== 'linking' || !code) return
    const interval = setInterval(async () => {
      const used = await checkCodeUsed(code)
      if (used) {
        const result = await getLinkingStatus()
        setAccounts(result.accounts)
        setStatus('ready')
        setCode('')
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [status, code])

  // Countdown timer
  useEffect(() => {
    if (expiresIn <= 0) return
    const timer = setInterval(() => {
      setExpiresIn(prev => {
        if (prev <= 1) {
          setStatus('ready')
          setCode('')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [expiresIn])

  function handleGenerateCode() {
    setError('')
    startTransition(async () => {
      const result = await generateLinkingCode()
      if (result.error) {
        setError(result.error)
      } else if (result.code) {
        setCode(result.code)
        setStatus('linking')
        setExpiresIn(600) // 10 นาที
      }
    })
  }

  function handleUnlink(accountId: string) {
    if (!confirm('ยกเลิกเชื่อม LINE นี้? จะไม่ได้รับแจ้งเตือนทาง LINE นี้อีก')) return
    startTransition(async () => {
      const result = await unlinkLine(accountId)
      if (result.success) {
        setAccounts(prev => prev.filter(a => a.id !== accountId))
      } else {
        setError(result.error || 'ไม่สามารถยกเลิกได้')
      }
    })
  }

  const minutes = Math.floor(expiresIn / 60)
  const seconds = expiresIn % 60

  if (status === 'loading') {
    return (
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#00B900]/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#00B900]" fill="currentColor">
            <path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.83 1.88 5.32 4.7 6.82-.17.57-.6 2.1-.69 2.42-.11.4.15.4.31.29.12-.08 1.89-1.25 2.66-1.76.64.1 1.31.15 2.02.15 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">LINE Notification</h3>
          <p className="text-xs text-gray-400">
            เชื่อม LINE เพื่อรับแจ้งเตือน
            {linkedCount !== null && <span className="ml-2 text-gray-500">({linkedCount} บัญชีเชื่อมแล้ว)</span>}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* แสดง list LINE accounts ที่ผูกแล้ว */}
      {accounts.length > 0 && (
        <div className="mb-4 space-y-2">
          {accounts.map((account, index) => (
            <div key={account.id} className="flex items-center justify-between bg-[#111111] border border-[#2A2A2A] rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00B900]" />
                <span className="text-sm text-white">LINE #{index + 1}</span>
                <span className="text-xs text-gray-500 font-mono">({account.lineUserId.slice(0, 8)}...)</span>
              </div>
              <Button
                onClick={() => handleUnlink(account.id)}
                disabled={isPending}
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2"
              >
                <Unlink className="w-3.5 h-3.5 mr-1" />
                ยกเลิก
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ปุ่มเชื่อม LINE เพิ่ม (แสดงเสมอ) */}
      {status === 'ready' && (
        <div>
          {accounts.length > 0 && (
            <p className="text-sm text-gray-400 mb-3">
              ระบบจะส่งแจ้งเตือนไปทุก LINE ที่ผูกไว้
            </p>
          )}
          {accounts.length === 0 && (
            <p className="text-sm text-gray-400 mb-4">
              เชื่อม LINE เพื่อรับแจ้งเตือนนัดหมาย กิจวัตร และสรุปประจำวัน
            </p>
          )}
          <Button
            onClick={handleGenerateCode}
            disabled={isPending}
            className="bg-[#00B900] hover:bg-[#00A000] text-white"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : accounts.length > 0 ? (
              <Plus className="w-4 h-4 mr-2" />
            ) : (
              <LinkIcon className="w-4 h-4 mr-2" />
            )}
            {accounts.length > 0 ? 'เชื่อม LINE เพิ่ม' : 'เชื่อม LINE'}
          </Button>
        </div>
      )}

      {/* สถานะ: กำลังเชื่อม (แสดง code) */}
      {status === 'linking' && code && (
        <div>
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-5 mb-4">
            {/* ขั้นตอน */}
            <div className="space-y-3 mb-5">
              <div className="flex items-start gap-3">
                <span className="bg-[#00B900] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div>
                  <p className="text-sm text-white">Scan QR Code เพื่อ Add Friend</p>
                  <div className="mt-2 bg-white rounded-lg p-3 inline-block">
                    <Image
                      src="/line-bot-qr.png"
                      alt="LINE Bot QR Code"
                      width={150}
                      height={150}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-[#00B900] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div>
                  <p className="text-sm text-white">พิมพ์รหัสนี้ในแชท LINE bot</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-3xl font-mono font-bold text-[#00B900] tracking-[0.3em]">{code}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Countdown */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>รหัสหมดอายุใน {minutes}:{seconds.toString().padStart(2, '0')} นาที</span>
              <button
                onClick={handleGenerateCode}
                disabled={isPending}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                สร้างรหัสใหม่
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            ระบบจะเชื่อมอัตโนมัติเมื่อพิมพ์รหัสถูกต้อง
          </p>
        </div>
      )}
    </div>
  )
}
