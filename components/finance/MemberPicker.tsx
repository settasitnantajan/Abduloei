'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { splitAmount } from '@/lib/finance/calc';
import type { FinanceMember } from '@/lib/types/finance';

interface MemberPickerProps {
  members: FinanceMember[];
  /** คนที่ร่วมหารรายการนี้อยู่ตอนนี้ — ว่าง = ยังไม่ระบุ */
  sharedBy: string[];
  /** ยอดเต็มของรายการ ใช้คำนวณว่าแต่ละคนรับเท่าไร */
  amount: number;
  /** บันทึกรายชื่อผู้ร่วมหารชุดใหม่ */
  onChange: (memberIds: string[]) => Promise<{ success: boolean; error?: string }>;
  /** ชื่อรายการ ใช้บอก screen reader ว่ากำลังตั้งให้รายการไหน */
  itemLabel: string;
}

/** แสดงยอดแบบมีสตางค์เฉพาะเมื่อมีจริง */
function money(n: number): string {
  const hasSatang = Math.abs(n % 1) > 0.004;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: hasSatang ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/**
 * ป้ายผู้ร่วมหารที่กดเปลี่ยนได้ในตัว
 *
 * รายการหนึ่งหารกันได้หลายคน เลือกได้ว่าใครร่วมบ้าง แล้วระบบหารเท่ากันให้
 * ยอดต่อคนคำนวณสดจากยอดเต็ม ไม่ได้เก็บไว้ — แก้ยอดรายการทีหลังก็ถูกเอง
 *
 * ต่างจาก RowMenu ตรงที่เมนูนี้เลือกได้หลายคน จึงไม่ปิดเมนูทันทีที่กด
 * แต่รอให้กด "เสร็จ" หรือคลิกนอกเมนูก่อนค่อยบันทึก
 */
export default function MemberPicker({
  members,
  sharedBy,
  amount,
  onChange,
  itemLabel,
}: MemberPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // รายชื่อที่กำลังแก้อยู่ — มีค่าเฉพาะตอนเมนูเปิด
  // ไม่ sync กับ props ด้วย effect เพื่อไม่ให้ค่าจาก server ที่มาทีหลัง
  // ทับสิ่งที่ผู้ใช้กำลังติ๊กค้างไว้
  const [draft, setDraft] = useState<string[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  /** รายชื่อที่ใช้แสดง — ยังไม่เปิดเมนูก็ใช้ค่าจาก server */
  const current = draft ?? sharedBy;

  /** บันทึกเมื่อรายชื่อต่างจากเดิมจริง */
  const commit = (next: string[]) => {
    const same =
      next.length === sharedBy.length && next.every(id => sharedBy.includes(id));
    if (same) return;

    startTransition(async () => {
      const result = await onChange(next);
      if (!result.success) {
        toast.error(result.error || 'บันทึกผู้ร่วมหารไม่สำเร็จ');
      }
      // รีเฟรชทั้งสองทาง — สำเร็จเพื่อเอายอดใหม่ ล้มเหลวเพื่อดึงค่าจริงกลับมา
      router.refresh();
    });
  };

  const close = () => {
    setOpen(false);
    const next = draft;
    setDraft(null);
    if (next) commit(next);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // close ปิดทับ draft ล่าสุดอยู่แล้วผ่าน closure ที่สร้างใหม่ทุก render
  });

  // กันคลิกทะลุไปโดนหัวข้อที่พับ/กางอยู่ข้างหลัง
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const toggle = (memberId: string) => {
    setDraft(prev => {
      const base = prev ?? sharedBy;
      return base.includes(memberId)
        ? base.filter(id => id !== memberId)
        : [...base, memberId];
    });
  };

  // ป้ายบนแถว: ไม่ระบุ / ชื่อคนเดียว / "หาร N คน"
  const names = sharedBy
    .map(id => members.find(m => m.id === id)?.name)
    .filter(Boolean) as string[];
  const unassigned = names.length === 0;
  const label = unassigned
    ? 'ไม่ระบุ'
    : names.length === 1
      ? names[0]
      : `หาร ${names.length} คน`;

  // ยอดที่แต่ละคนรับ ตามรายชื่อที่กำลังเลือกอยู่ในเมนู
  const previewParts = splitAmount(amount, current);

  return (
    <div ref={wrapRef} className="relative shrink-0" onClick={stop}>
      <button
        type="button"
        onClick={e => {
          stop(e);
          if (open) {
            close();
          } else {
            setDraft(sharedBy);
            setOpen(true);
          }
        }}
        disabled={isPending}
        aria-label={`เลือกผู้ร่วมหารของ ${itemLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-1 text-[0.65rem] px-1.5 py-0.5 rounded transition-colors disabled:opacity-60 ${
          unassigned
            ? 'bg-[#F5A524]/15 text-[#F5A524] hover:bg-[#F5A524]/25'
            : 'bg-[#26262A] text-gray-400 hover:bg-[#333338] hover:text-gray-200'
        }`}
      >
        {isPending ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : names.length > 1 ? (
          <Users className="w-2.5 h-2.5" />
        ) : null}
        {label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 w-44 max-w-[calc(100vw-2rem)] bg-[#1F1F22] border border-[#333338] rounded-xl shadow-xl overflow-hidden"
        >
          <p className="px-3 pt-2 pb-1 text-[0.6rem] text-gray-500">
            ใครร่วมหารบ้าง (เลือกได้หลายคน)
          </p>

          {members.map(m => {
            const index = current.indexOf(m.id);
            const picked = index !== -1;
            return (
              <button
                key={m.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={picked}
                onClick={e => {
                  stop(e);
                  toggle(m.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[#26262A] transition-colors text-left"
              >
                <span
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    picked ? 'bg-[#00B900] border-[#00B900]' : 'border-[#444]'
                  }`}
                >
                  {picked && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className={`flex-1 ${picked ? 'text-gray-200' : 'text-gray-500'}`}>
                  {m.name}
                </span>
                {picked && (
                  <span className="text-[0.65rem] text-[#00B900] tabular-nums">
                    ฿{money(previewParts[index])}
                  </span>
                )}
              </button>
            );
          })}

          <div className="border-t border-[#333338]">
            {current.length > 0 && (
              <p className="px-3 py-1.5 text-[0.6rem] text-gray-500">
                {current.length === 1
                  ? 'รับผิดชอบคนเดียว'
                  : `หารกัน ${current.length} คน จากยอด ฿${money(amount)}`}
              </p>
            )}
            <div className="flex">
              <button
                type="button"
                onClick={e => {
                  stop(e);
                  setDraft([]);
                }}
                className="flex-1 px-3 py-2 text-xs text-gray-500 hover:bg-[#26262A] transition-colors"
              >
                ล้าง
              </button>
              <button
                type="button"
                onClick={e => {
                  stop(e);
                  close();
                }}
                className="flex-1 px-3 py-2 text-xs text-[#00B900] hover:bg-[#00B900]/10 transition-colors font-medium"
              >
                เสร็จ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
