'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import FinanceModal, {
  dateInputClass,
  inputClass,
  labelClass,
} from '@/components/finance/FinanceModal';
import { createExpiryItem, updateExpiryItem } from '@/app/actions/expiry';
import { todayBangkok } from '@/lib/expiry/calc';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  type ExpiryCategory,
  type ExpiryItem,
} from '@/lib/types/expiry';

/** อ่านข้อความจากฟอร์ม */
function str(data: FormData, key: string): string {
  return ((data.get(key) as string | null) ?? '').trim();
}

export default function ExpiryForm({
  item,
  onClose,
}: {
  /** มีค่า = โหมดแก้ไข */
  item?: ExpiryItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const editing = !!item;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);

    const input = {
      name: str(data, 'name'),
      category: str(data, 'category') as ExpiryCategory,
      purchasedOn: str(data, 'purchasedOn') || null,
      expiresOn: str(data, 'expiresOn'),
      remindBeforeDays: Number(str(data, 'remindBeforeDays') || 3),
      note: str(data, 'note') || null,
    };

    setError(null);
    startTransition(async () => {
      const result = editing
        ? await updateExpiryItem(item.id, input)
        : await createExpiryItem(input);

      if (result.success) {
        toast.success(editing ? 'แก้ไขแล้ว' : 'เพิ่มของแล้ว');
        onClose();
        router.refresh();
      } else {
        setError(result.error || 'เกิดข้อผิดพลาด');
      }
    });
  };

  return (
    <FinanceModal
      title={editing ? 'แก้ไขของ' : 'เพิ่มของ'}
      icon={<Package className="w-4 h-4" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isPending={isPending}
      submitLabel={editing ? 'บันทึก' : 'เพิ่มของ'}
      pendingLabel="กำลังบันทึก..."
    >
      <div className="space-y-1.5">
        <label className={labelClass}>
          ชื่อของ <span className="text-red-400">*</span>
        </label>
        <input
          name="name"
          type="text"
          defaultValue={item?.name}
          placeholder="เช่น นมสด, พาราเซตามอล"
          className={inputClass}
          required
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>
          หมวด <span className="text-red-400">*</span>
        </label>
        <select
          name="category"
          defaultValue={item?.category ?? 'food'}
          className={inputClass}
        >
          {CATEGORY_ORDER.map(c => (
            <option key={c} value={c}>
              {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>ซื้อเมื่อ</label>
          <input
            name="purchasedOn"
            type="date"
            defaultValue={item?.purchasedOn ?? ''}
            className={dateInputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>
            หมดอายุ <span className="text-red-400">*</span>
          </label>
          <input
            name="expiresOn"
            type="date"
            defaultValue={item?.expiresOn ?? todayBangkok()}
            className={dateInputClass}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>เตือนล่วงหน้า</label>
        <select
          name="remindBeforeDays"
          defaultValue={String(item?.remindBeforeDays ?? 3)}
          className={inputClass}
        >
          <option value="0">ไม่เตือน</option>
          {[1, 3, 7, 14, 30].map(d => (
            <option key={d} value={d}>
              {d} วัน
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>หมายเหตุ</label>
        <input
          name="note"
          type="text"
          defaultValue={item?.note ?? ''}
          placeholder="เช่น เก็บในตู้เย็นชั้นบน"
          className={inputClass}
        />
      </div>

      <p className="text-xs text-gray-500">
        ของที่หมดอายุแล้วจะเก็บไว้อีก 30 วัน แล้วระบบลบให้เอง
      </p>
    </FinanceModal>
  );
}
