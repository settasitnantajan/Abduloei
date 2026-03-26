'use client'

import { useState } from 'react'
import { ParsedCommand } from '@/lib/types/command'
import { formatThaiDate } from '@/lib/utils/thai-date-parser'
import { CalendarIcon, CheckCircle2Icon, ClockIcon, AlertCircleIcon, StickyNoteIcon, UserIcon, ListChecksIcon, Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

interface CommandCardProps {
  command: ParsedCommand
  executed?: boolean
  pending?: boolean
  onConfirm?: () => Promise<void>
  onCancel?: () => Promise<void>
}

export default function CommandCard({
  command,
  executed = false,
  pending = false,
  onConfirm,
  onCancel
}: CommandCardProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)

  const handleConfirm = async () => {
    if (!onConfirm) return
    setIsConfirming(true)
    try {
      await onConfirm()
    } catch (error) {
      console.error('Confirmation error:', error)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancel = async () => {
    if (!onCancel) return
    setIsCanceling(true)
    try {
      await onCancel()
    } catch (error) {
      console.error('Cancel error:', error)
    } finally {
      setIsCanceling(false)
    }
  }
  const typeConfig = {
    create_event: {
      icon: CalendarIcon,
      label: 'นัดหมาย',
      bgColor: 'bg-[#00B900]/10',
      borderColor: 'border-[#00B900]/30',
      iconColor: 'text-[#00B900]'
    },
    create_task: {
      icon: CheckCircle2Icon,
      label: 'งานที่ต้องทำ',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-500'
    },
    create_note: {
      icon: StickyNoteIcon,
      label: 'บันทึก',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-500'
    },
    delete_all: {
      icon: CheckCircle2Icon,
      label: 'ลบทั้งหมด',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      iconColor: 'text-red-500'
    },
    edit_event: {
      icon: CalendarIcon,
      label: 'แก้ไขนัดหมาย',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      iconColor: 'text-orange-500'
    },
    create_routine: {
      icon: CalendarIcon,
      label: 'กิจวัตรประจำวัน',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-500'
    }
  }

  const config = typeConfig[command.type] || typeConfig.create_event
  const Icon = config.icon

  return (
    <div
      className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`${config.iconColor} mt-0.5`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${config.iconColor}`}>
              {config.label}
            </span>
            {command.priority === 'high' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                <AlertCircleIcon className="w-3 h-3" />
                สำคัญ
              </span>
            )}
            {executed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                <CheckCircle2Icon className="w-3 h-3" />
                {command.type === 'delete_all' ? 'ลบแล้ว' : 'สร้างแล้ว'}
              </span>
            )}
            {pending && !executed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium animate-pulse">
                ⏳ รอยืนยัน
              </span>
            )}
          </div>
          <h4 className="text-white font-medium mt-1 text-base">
            {command.title}
          </h4>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 pl-8">
        {command.date && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <CalendarIcon className="w-4 h-4 text-gray-400" />
            <span>{formatThaiDate(command.date)}</span>
          </div>
        )}

        {command.time && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <ClockIcon className="w-4 h-4 text-gray-400" />
            <span>{command.time} น.</span>
          </div>
        )}

        {command.description && (
          <p className="text-sm text-gray-400 italic">
            {command.description}
          </p>
        )}

        {/* Checklist Items Preview */}
        {command.checklist_items && command.checklist_items.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <ListChecksIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400 font-medium">
                รายการ ({command.checklist_items.length} รายการ)
              </span>
            </div>
            <div className="space-y-1.5">
              {command.checklist_items.slice(0, 3).map((item, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-gray-500 mt-0.5">☐</span>
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <span>{item.title}</span>
                    {item.assignee && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <UserIcon className="w-3 h-3" />
                        {item.assignee}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {command.checklist_items.length > 3 && (
                <div className="text-xs text-gray-500 pl-5">
                  และอีก {command.checklist_items.length - 3} รายการ
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Buttons */}
      {pending && !executed && onConfirm && onCancel && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 mt-4"
        >
          <Button
            onClick={handleConfirm}
            disabled={isConfirming || isCanceling}
            className={`flex-1 h-12 text-white font-semibold ${
              command.type === 'delete_all'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#00B900] hover:bg-[#00A000]'
            }`}
          >
            {isConfirming ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
                {command.type === 'delete_all' ? 'กำลังลบ...' : 'กำลังสร้าง...'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                {command.type === 'delete_all' ? 'ยืนยันลบ' : 'ยืนยันสร้าง'}
              </span>
            )}
          </Button>
          <Button
            onClick={handleCancel}
            disabled={isConfirming || isCanceling}
            variant="outline"
            className="flex-1 h-12 border-[#333333] text-gray-300 hover:text-white hover:bg-[#2A2A2A]"
          >
            <span className="flex items-center gap-2">
              <X className="w-5 h-5" />
              ยกเลิก
            </span>
          </Button>
        </motion.div>
      )}

    </div>
  )
}
