'use client';

import { X, Loader2 } from 'lucide-react';

/** คลาสของช่องกรอก ใช้ร่วมกันทุกฟอร์มในหน้าการเงิน */
export const inputClass =
  'w-full h-10 px-3 rounded-lg border border-[#333338] bg-[#111111] text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-[#00B900]/60 focus:ring-2 focus:ring-[#00B900]/20 transition-colors';

export const labelClass = 'text-sm font-medium text-gray-300';

/** ช่องวันที่/เวลาต้องบังคับธีมมืด ไม่งั้นปฏิทินของเบราว์เซอร์จะเป็นสีขาว */
export const dateInputClass = `${inputClass} [color-scheme:dark]`;

interface FinanceModalProps {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error?: string | null;
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
  children: React.ReactNode;
}

/**
 * โครงโมดัลที่ใช้ร่วมกันทุกฟอร์มของหน้าการเงิน
 *
 * ยึดรูปแบบเดียวกับโมดัลที่มีอยู่แล้วในแอป (components/monthly-routines/MonthlyRoutinesList.tsx)
 * — overlay เต็มจอ กดพื้นหลังเพื่อปิด ชิดล่างบนมือถือ กลางจอบนเดสก์ท็อป
 */
export default function FinanceModal({
  title,
  icon,
  onClose,
  onSubmit,
  error,
  isPending,
  submitLabel,
  pendingLabel,
  children,
}: FinanceModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#1A1A1A] border border-[#333338] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00B900]/20 flex items-center justify-center text-[#00B900]">
              {icon}
            </div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 pb-20 sm:pb-5 space-y-4">
          {children}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-[#333338] text-gray-300 text-sm font-medium hover:bg-[#2A2A2A] transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 h-10 rounded-lg bg-[#00B900] hover:bg-[#00A000] disabled:bg-[#00B900]/50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {pendingLabel}
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** ตัวเลือก "ใครรับผิดชอบ" — ใช้ซ้ำทุกฟอร์มที่ต้องระบุคน */
export function MemberSelect({
  members,
  name = 'memberId',
  defaultValue,
  label = 'ของใคร',
}: {
  members: { id: string; name: string }[];
  name?: string;
  defaultValue?: string | null;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className={labelClass}>{label}</label>
      <select name={name} defaultValue={defaultValue ?? ''} className={inputClass}>
        <option value="">ไม่ระบุ</option>
        {members.map(m => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** ตัวเลือกวันที่ของเดือน 1-31 + สิ้นเดือน (32 ตาม convention เดิมของแอป) */
export function DayOfMonthSelect({
  name = 'dayOfMonth',
  defaultValue = 1,
  label = 'ทุกวันที่',
}: {
  name?: string;
  defaultValue?: number;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className={labelClass}>
        {label} <span className="text-red-400">*</span>
      </label>
      <select name={name} defaultValue={String(defaultValue)} className={inputClass}>
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            วันที่ {i + 1}
          </option>
        ))}
        <option value="32">สิ้นเดือน</option>
      </select>
    </div>
  );
}
