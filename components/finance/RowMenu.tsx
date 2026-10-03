'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, Repeat } from 'lucide-react';

interface RowMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  /** ข้อความบนปุ่มลบ เช่น "ลบบัตร" */
  deleteLabel?: string;
  /** ชื่อรายการ ใช้บอก screen reader ว่าเมนูนี้ของอะไร */
  itemLabel: string;
  /** เมนูเสริมระหว่างแก้ไขกับลบ — ไม่ส่งมาก็ไม่แสดง */
  extraAction?: { label: string; onClick: () => void };
}

/**
 * เมนู ⋯ สำหรับแก้ไข/ลบ ใช้ร่วมกันทุกแถวในหน้าการเงิน
 *
 * ปิดเมื่อคลิกนอกเมนูหรือกด Escape
 */
export default function RowMenu({
  onEdit,
  onDelete,
  deleteLabel = 'ลบ',
  itemLabel,
  extraAction,
}: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // กันคลิกทะลุไปโดนหัวข้อที่พับ/กางอยู่ข้างหลัง
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div ref={wrapRef} className="relative shrink-0" onClick={stop}>
      <button
        type="button"
        onClick={e => {
          stop(e);
          setOpen(v => !v);
        }}
        aria-label={`ตัวเลือกของ ${itemLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="p-1.5 -m-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#26262A] transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 min-w-[9rem] bg-[#1F1F22] border border-[#333338] rounded-xl shadow-xl overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={e => {
              stop(e);
              setOpen(false);
              onEdit();
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-200 hover:bg-[#26262A] transition-colors text-left"
          >
            <Pencil className="w-3.5 h-3.5 shrink-0" />
            แก้ไข
          </button>
          {extraAction && (
            <button
              type="button"
              role="menuitem"
              onClick={e => {
                stop(e);
                setOpen(false);
                extraAction.onClick();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-200 hover:bg-[#26262A] transition-colors text-left border-t border-[#333338]"
            >
              <Repeat className="w-3.5 h-3.5 shrink-0" />
              {extraAction.label}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={e => {
              stop(e);
              setOpen(false);
              onDelete();
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#F0384E] hover:bg-[#F0384E]/10 transition-colors text-left border-t border-[#333338]"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            {deleteLabel}
          </button>
        </div>
      )}
    </div>
  );
}
