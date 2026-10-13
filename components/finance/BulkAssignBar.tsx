'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { setSharesBulk } from '@/app/actions/finance';
import type { FinanceMember } from '@/lib/types/finance';

/**
 * แถบกำหนดผู้ร่วมหารให้หลายรายการพร้อมกัน
 *
 * ใบแจ้งยอดใบหนึ่งมีหลายสิบรายการ การกดทีละรายการแล้วเลือกคนทีละครั้งช้าเกินไป
 * แถบนี้ให้ติ๊กหลายรายการแล้วกำหนดครั้งเดียวจบ
 */
export default function BulkAssignBar({
  members,
  selectedIds,
  recurringIds = [],
  onClear,
}: {
  members: FinanceMember[];
  /** รายการที่ติ๊กไว้ (บัตร + เงินสด ใช้ตาราง expense เดียวกัน) */
  selectedIds: string[];
  /** รายจ่ายประจำที่ติ๊กไว้ — คนละตารางจึงต้องยิงแยก */
  recurringIds?: string[];
  /** เรียกเมื่อบันทึกเสร็จหรือผู้ใช้ยกเลิก */
  onClear: () => void;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setPicked(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const total = selectedIds.length + recurringIds.length;

  const apply = (memberIds: string[]) => {
    startTransition(async () => {
      const results = await Promise.all([
        selectedIds.length > 0
          ? setSharesBulk('expense', selectedIds, memberIds)
          : null,
        recurringIds.length > 0
          ? setSharesBulk('recurring', recurringIds, memberIds)
          : null,
      ]);

      const failed = results.find(r => r && !r.success);
      if (failed) {
        toast.error(failed.error ?? 'บันทึกไม่สำเร็จ');
        return;
      }

      const updated = results.reduce((sum, r) => sum + (r?.updated ?? 0), 0);
      toast.success(
        memberIds.length === 0
          ? `ล้างผู้ร่วมหาร ${updated || total} รายการแล้ว`
          : `กำหนด ${updated || total} รายการแล้ว`
      );
      setPicked([]);
      onClear();
      router.refresh();
    });
  };

  if (total === 0) return null;

  return (
    <div className="sticky bottom-3 z-20 mt-3 rounded-xl border border-[#00B900]/40 bg-[#14241A] shadow-xl shadow-black/40 p-3">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span className="text-xs text-[#00B900] font-medium">
          เลือกไว้ {total} รายการ
        </span>
        <button
          type="button"
          onClick={onClear}
          disabled={isPending}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[#3A3A40] bg-[#1F1F22] text-gray-300 hover:text-white hover:border-[#4A4A52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer disabled:opacity-60"
        >
          <X className="w-3.5 h-3.5" />
          ยกเลิก
        </button>
      </div>

      <p className="text-[0.65rem] text-gray-400 mb-1.5">ให้ใครร่วมหาร</p>
      <div className="flex flex-wrap gap-2">
        {members.map(m => {
          const on = picked.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              disabled={isPending}
              aria-pressed={on}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 disabled:opacity-60 ${
                on
                  ? 'bg-[#00B900]/20 border-[#00B900]/60 text-[#00B900]'
                  : 'bg-[#1F1F22] border-[#3A3A40] text-gray-300 hover:border-[#00B900]/40'
              }`}
            >
              {on && <Check className="w-3 h-3" />}
              {m.name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[#00B900]/20">
        <button
          type="button"
          onClick={() => apply(picked)}
          disabled={isPending || picked.length === 0}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-[#00B900] text-black font-medium hover:bg-[#00D400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          กำหนดให้ {total} รายการ
        </button>

        <button
          type="button"
          onClick={() => apply([])}
          disabled={isPending}
          className="text-xs px-2.5 py-2 rounded-lg border border-[#3A3A40] bg-[#1F1F22] text-gray-400 hover:text-[#F5A524] hover:border-[#F5A524]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5A524]/60 transition-colors cursor-pointer disabled:opacity-60"
        >
          ล้างผู้ร่วมหาร
        </button>
      </div>
    </div>
  );
}
