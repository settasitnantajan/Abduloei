'use client';

import { useEffect, useId, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';

/** คลาสของช่องกรอก ใช้ร่วมกันทุกฟอร์มในหน้าการเงิน — สูง 44px ตามขนาดนิ้วขั้นต่ำ */
export const inputClass =
  'w-full h-11 px-3 rounded-lg border border-[#333338] bg-[#111111] text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-[#00B900]/60 focus:ring-2 focus:ring-[#00B900]/20 transition-colors';

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
 * ปุ่มบันทึกอยู่นอกพื้นที่เลื่อน เพราะฟอร์มยาวบนมือถือจะดันปุ่มตกจอ
 * กด Escape ปิดได้เหมือน RowMenu/MemberPicker และล็อกไม่ให้หน้าหลังเลื่อนตาม
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
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // ปุ่มที่โฟกัสอยู่ก่อนเปิด เอาไว้คืนโฟกัสตอนปิด
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;

    // ล็อกหน้าหลังไม่ให้เลื่อนตามเวลาเลื่อนจนสุดโมดัลบนมือถือ
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // โฟกัสช่องแรกในฟอร์ม ไม่ใช่ปุ่มปิด
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea'
    );
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // ขังโฟกัสไว้ในโมดัล ไม่ให้หลุดไปหน้าหลังที่อยู่ใต้ overlay
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, input:not([type="hidden"]), select, textarea, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;

      const list = [...focusables].filter(el => !el.hasAttribute('disabled'));
      const firstEl = list[0];
      const lastEl = list[list.length - 1];

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md max-h-[85dvh] flex flex-col bg-[#1A1A1A] border border-[#333338] rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A2A] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00B900]/20 flex items-center justify-center text-[#00B900]">
              {icon}
            </div>
            <h2 id={titleId} className="text-base font-semibold text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* ข้อผิดพลาดอยู่บนสุด ฟอร์มยาวจะได้ไม่ต้องเลื่อนลงไปหา */}
            {error && (
              <div
                role="alert"
                className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400"
              >
                {error}
              </div>
            )}

            {children}
          </div>

          {/* ปุ่มติดล่างเสมอ — pb เผื่อแถบ home indicator ของ iOS */}
          <div className="flex gap-3 p-5 pt-3 border-t border-[#2A2A2A] shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-lg border border-[#333338] text-gray-300 text-sm font-medium hover:bg-[#2A2A2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 h-11 rounded-lg bg-[#00B900] hover:bg-[#00A000] disabled:bg-[#00B900]/50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 cursor-pointer"
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

/**
 * ตัวเลือก "ใครรับผิดชอบ" — ใช้ซ้ำทุกฟอร์มที่ต้องระบุคน
 *
 * บ้านมีไม่กี่คน ใช้ปุ่มเรียงแทน select เพราะกดครั้งเดียวจบ
 * ไม่ต้องเปิดลิสต์แล้วเลื่อนหาเหมือน select บน iOS
 */
export function MemberSelect({
  members,
  name = 'memberId',
  defaultValue,
  label = 'ของใคร',
  allowNone = true,
}: {
  members: { id: string; name: string }[];
  name?: string;
  defaultValue?: string | null;
  label?: string;
  /** ให้เลือก "ไม่ระบุ" ได้ไหม — ปิดเมื่อรู้คำตอบอยู่แล้ว เช่นบัตรมีเจ้าของ */
  allowNone?: boolean;
}) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ''}
        className={inputClass}
      >
        {allowNone && <option value="">ไม่ระบุ</option>}
        {members.map(m => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * เลือกว่าใครร่วมหารรายการนี้บ้าง — ติ๊กได้หลายคน
 *
 * ตั้งต้นติ๊กทุกคนเพราะรายจ่ายในบ้านส่วนใหญ่หารกัน
 * ถามตั้งแต่ตอนสร้างจะได้ไม่มีรายการค้างให้มาไล่กดทีหลัง
 */
export function SharedBySelect({
  members,
  name = 'sharedBy',
  defaultValue,
  label = 'ใครหารบ้าง',
}: {
  members: { id: string; name: string }[];
  name?: string;
  /** undefined = รายการใหม่ ให้ติ๊กทุกคน */
  defaultValue?: string[];
  label?: string;
}) {
  const picked = defaultValue ?? members.map(m => m.id);

  return (
    <fieldset className="space-y-1.5">
      <legend className={labelClass}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {members.map(m => (
          <label
            key={m.id}
            className="flex items-center gap-2 h-11 px-3 rounded-lg border border-[#333338] bg-[#111111] text-sm text-gray-300 cursor-pointer hover:border-[#00B900]/50 has-checked:border-[#00B900]/60 has-checked:bg-[#00B900]/10 has-checked:text-[#00B900] transition-colors"
          >
            <input
              type="checkbox"
              name={name}
              value={m.id}
              defaultChecked={picked.includes(m.id)}
              className="w-4 h-4 accent-[#00B900] cursor-pointer"
            />
            {m.name}
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500">หารเท่ากันตามจำนวนคนที่ติ๊ก</p>
    </fieldset>
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
  const id = useId();

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label} <span className="text-red-400">*</span>
      </label>
      <select
        id={id}
        name={name}
        defaultValue={String(defaultValue)}
        className={inputClass}
      >
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            วันที่ {i + 1}
          </option>
        ))}
        <option value="32">สิ้นเดือน (วันสุดท้ายของเดือนนั้น)</option>
      </select>
    </div>
  );
}
