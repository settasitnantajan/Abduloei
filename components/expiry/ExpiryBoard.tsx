'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, AlertTriangle, Clock, PackageOpen } from 'lucide-react';
import { toast } from 'sonner';
import RowMenu from '@/components/finance/RowMenu';
import ExpiryForm from './ExpiryForm';
import { deleteExpiryItem } from '@/app/actions/expiry';
import { describeDaysLeft, formatThaiDate, groupItems } from '@/lib/expiry/calc';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  type ExpiryCategory,
  type ExpiryItem,
  type ExpiryItemView,
} from '@/lib/types/expiry';

/** แถวของ 1 ชิ้น — สีขอบบอกความเร่งด่วน */
function ItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: ExpiryItemView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = CATEGORY_META[item.category];

  const tone =
    item.status === 'expired'
      ? 'border-[#F0384E]/40 bg-[#F0384E]/[0.06]'
      : item.status === 'soon'
        ? 'border-[#F5A524]/40 bg-[#F5A524]/[0.06]'
        : 'border-[#26262A] bg-[#161618]';

  const dayTone =
    item.status === 'expired'
      ? 'text-[#F0384E]'
      : item.status === 'soon'
        ? 'text-[#F5A524]'
        : 'text-gray-400';

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3.5 ${tone}`}>
      <span className="text-xl w-8 text-center shrink-0">{meta.icon}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{item.name}</p>
        <p className="text-xs text-gray-500">
          {meta.label}
          {item.purchasedOn && ` · ซื้อ ${formatThaiDate(item.purchasedOn)}`}
          {' · หมด '}
          {formatThaiDate(item.expiresOn)}
        </p>
        {item.note && <p className="text-[0.65rem] text-gray-600 truncate">{item.note}</p>}
        {item.daysUntilRemoved !== null && (
          <p className="text-[0.65rem] text-gray-600">
            ลบอัตโนมัติใน {item.daysUntilRemoved} วัน
          </p>
        )}
      </div>

      <span className={`text-xs font-medium tabular-nums shrink-0 ${dayTone}`}>
        {describeDaysLeft(item.daysLeft)}
      </span>

      <RowMenu itemLabel={item.name} onEdit={onEdit} onDelete={onDelete} deleteLabel="ลบของ" />
    </div>
  );
}

/** หัวข้อกลุ่ม */
function GroupTitle({
  icon: Icon,
  label,
  count,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1 mb-2 mt-5 first:mt-0">
      <Icon className={`w-3.5 h-3.5 ${tone}`} />
      <h2 className={`text-sm font-medium ${tone}`}>{label}</h2>
      <span className="text-xs text-gray-600">{count}</span>
    </div>
  );
}

export default function ExpiryBoard({ items }: { items: ExpiryItem[] }) {
  const router = useRouter();
  const [, startDeleting] = useTransition();
  const [modal, setModal] = useState<null | { item?: ExpiryItem }>(null);
  const [filter, setFilter] = useState<ExpiryCategory | 'all'>('all');

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter(i => i.category === filter)),
    [items, filter]
  );

  // จัดกลุ่มใน client เพราะต้องอ้างอิง "วันนี้" ซึ่งเปลี่ยนไปตามเวลาจริง
  const groups = useMemo(() => groupItems(visible), [visible]);

  // หมวดที่มีของจริง — ไม่ต้องโชว์ปุ่มกรองของหมวดที่ว่าง
  const usedCategories = useMemo(
    () => CATEGORY_ORDER.filter(c => items.some(i => i.category === c)),
    [items]
  );

  const confirmDelete = (item: ExpiryItem) => {
    if (!window.confirm(`ลบ "${item.name}" ใช่ไหม?`)) return;
    startDeleting(async () => {
      const result = await deleteExpiryItem(item.id);
      if (result.success) {
        toast.success('ลบแล้ว');
        router.refresh();
      } else {
        toast.error(result.error || 'ลบไม่สำเร็จ');
      }
    });
  };

  const renderGroup = (list: ExpiryItemView[]) =>
    list.map(item => (
      <ItemRow
        key={item.id}
        item={item}
        onEdit={() => setModal({ item })}
        onDelete={() => confirmDelete(item)}
      />
    ));

  return (
    <div>
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-white">ของหมดอายุ</h1>
        <button
          type="button"
          onClick={() => setModal({})}
          className="flex items-center gap-1.5 text-sm bg-[#00B900] hover:bg-[#00A000] text-white rounded-lg px-3 py-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          เพิ่มของ
        </button>
      </header>

      {/* สรุปของที่ต้องจัดการ — ซ่อนเมื่อไม่มีอะไรต้องห่วง */}
      {(groups.expired.length > 0 || groups.soon.length > 0) && (
        <div className="flex items-center gap-3 bg-[#F5A524]/10 border border-[#F5A524]/30 rounded-xl p-3.5 mb-4 text-sm">
          <AlertTriangle className="w-4 h-4 text-[#F5A524] shrink-0" />
          <p className="text-gray-200">
            {groups.expired.length > 0 && (
              <span className="text-[#F0384E]">หมดอายุแล้ว {groups.expired.length}</span>
            )}
            {groups.expired.length > 0 && groups.soon.length > 0 && ' · '}
            {groups.soon.length > 0 && <span>ใกล้หมด {groups.soon.length}</span>}
          </p>
        </div>
      )}

      {/* ปุ่มกรองหมวด — โผล่เมื่อมีของมากกว่า 1 หมวด */}
      {usedCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-lg shrink-0 transition-colors ${
              filter === 'all'
                ? 'bg-[#00B900] text-white'
                : 'bg-[#1F1F22] text-gray-400 hover:text-white'
            }`}
          >
            ทั้งหมด
          </button>
          {usedCategories.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={`text-xs px-3 py-1.5 rounded-lg shrink-0 transition-colors ${
                filter === c
                  ? 'bg-[#00B900] text-white'
                  : 'bg-[#1F1F22] text-gray-400 hover:text-white'
              }`}
            >
              {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-[#161618] border border-[#26262A] rounded-xl p-12 text-center">
          <PackageOpen className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-300">ยังไม่มีของในรายการ</p>
          <p className="text-sm text-gray-500 mt-1">
            เพิ่มของที่มีวันหมดอายุ แล้วระบบจะเตือนให้ก่อนถึงกำหนด
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-[#161618] border border-[#26262A] rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">ไม่มีของในหมวดนี้</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.expired.length > 0 && (
            <>
              <GroupTitle
                icon={AlertTriangle}
                label="หมดอายุแล้ว"
                count={groups.expired.length}
                tone="text-[#F0384E]"
              />
              {renderGroup(groups.expired)}
            </>
          )}

          {groups.soon.length > 0 && (
            <>
              <GroupTitle
                icon={Clock}
                label="ใกล้หมดอายุ"
                count={groups.soon.length}
                tone="text-[#F5A524]"
              />
              {renderGroup(groups.soon)}
            </>
          )}

          {groups.fresh.length > 0 && (
            <>
              <GroupTitle
                icon={PackageOpen}
                label="ยังไม่หมดอายุ"
                count={groups.fresh.length}
                tone="text-gray-400"
              />
              {renderGroup(groups.fresh)}
            </>
          )}
        </div>
      )}

      {modal && <ExpiryForm item={modal.item} onClose={() => setModal(null)} />}
    </div>
  );
}
