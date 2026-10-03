'use client';

import { useState, useTransition } from 'react';
import {
  ChevronRight,
  ChevronDown,
  CreditCard,
  Banknote,
  Home,
  Bell,
  Plus,
  AlertTriangle,
  FileUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import RowMenu from './RowMenu';
import MemberPicker from './MemberPicker';
import {
  CardModal,
  ConvertToInstallmentModal,
  ExpenseModal,
  IncomeModal,
  InstallmentModal,
  RecurringModal,
} from './FinanceForms';
import StatementImport from './StatementImport';
import {
  deleteCard,
  deleteExpense,
  deleteInstallment,
  deleteRecurring,
  setShares,
} from '@/app/actions/finance';
import {
  summarizeMembers,
  groupTotal,
  groupTotalByMember,
  cardTotal,
  cardTotalByMember,
  cardExpenses,
  cardInstallments,
  grandTotal,
  installmentProgress,
  formatMonthLabel,
  toBuddhistYear,
} from '@/lib/finance/calc';
import type {
  CreditCard as CreditCardType,
  ExpenseGroup,
  ExpenseItem,
  FinanceMember,
  FinanceMonth,
  Installment as InstallmentType,
} from '@/lib/types/finance';

/** จัดรูปแบบเงินบาทแบบมีคอมมา */
function baht(n: number): string {
  // แสดงสตางค์เฉพาะเมื่อมีจริง — ยอดกลม ๆ จะได้ไม่รุงรังด้วย .00
  const hasSatang = Math.abs(n % 1) > 0.004;
  return `฿${n.toLocaleString('en-US', {
    minimumFractionDigits: hasSatang ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** ชื่อคนจาก id */
function memberName(data: FinanceMonth, id: string | null | undefined): string {
  if (!id) return 'ไม่ระบุ';
  return data.members.find(m => m.id === id)?.name ?? '—';
}

/**
 * ย่อวันที่สำหรับแสดงผล 2026-09-15 → 15/09/69
 * ข้อมูลเก็บเป็น ค.ศ. จึงแปลงเป็น พ.ศ. ตอนนี้
 */
function shortDate(date?: string | null): string | null {
  if (!date) return null;
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  const buddhistShort = String(toBuddhistYear(Number(parts[0]))).slice(-2);
  return `${parts[2]}/${parts[1]}/${buddhistShort}`;
}

/** วันที่แบบสั้นสำหรับหัวบัตร เช่น "6 ต.ค." */
function formatShortDate(iso: string): string {
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${months[m - 1]}`;
}

/** ช่วงวันที่ของรายการที่มีจริงในบัตร — ไม่ได้เดาจากรอบบิล */
function cardRange(items: { date?: string | null }[]): string {
  const dates = items.map(i => i.date).filter(Boolean).sort() as string[];
  if (dates.length === 0) return 'ยังไม่มีรายการ';
  const first = formatShortDate(dates[0]);
  const last = formatShortDate(dates[dates.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

/** แถบความคืบหน้า ใช้ทั้งการ์ดคนและงวดผ่อน */
function ProgressBar({ percent, danger }: { percent: number; danger?: boolean }) {
  // เกิน 100% ให้เต็มแถบ ไม่ล้นออกนอกกรอบ
  const width = Math.min(percent, 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-[#26262A] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${danger ? 'bg-[#F0384E]' : 'bg-[#00B900]'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/** ป้ายชื่อคน */
function MemberTag({ name }: { name: string }) {
  return (
    <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-[#26262A] text-gray-400 shrink-0">
      {name}
    </span>
  );
}

/** การ์ดสรุปของคนหนึ่งคน */
function MemberCard({
  summary,
  onEdit,
}: {
  summary: ReturnType<typeof summarizeMembers>[number];
  onEdit: () => void;
}) {
  const over = summary.remaining < 0;

  const chips: [ExpenseGroup, string, string][] = [
    ['credit_card', '💳', 'บัตร'],
    ['cash', '💵', 'เงินสด'],
    ['recurring', '🏠', 'ประจำ'],
  ];

  return (
    <div className="bg-[#161618] border border-[#26262A] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-white">{summary.member.name}</h2>
        <div className="flex items-center gap-2">
          {over && (
            <span className="flex items-center gap-1 text-xs text-[#F0384E]">
              <AlertTriangle className="w-3.5 h-3.5" />
              เกินงบ
            </span>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-gray-500 hover:text-[#00B900] transition-colors"
          >
            แก้รายรับ
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-0.5">คงเหลือ</p>
      <p
        className={`text-3xl font-bold tabular-nums mb-3 ${
          over ? 'text-[#F0384E]' : 'text-white'
        }`}
      >
        {over ? '-' : ''}
        {baht(Math.abs(summary.remaining))}
      </p>

      <ProgressBar percent={summary.usedPercent} danger={over} />
      <p className="text-xs text-gray-500 mt-1.5 mb-4 tabular-nums">
        {summary.usedPercent}% ใช้ไปแล้ว
      </p>

      <div className="flex items-center justify-between text-sm mb-4">
        <span className="text-gray-400">
          รายรับ <span className="text-gray-200 tabular-nums">{baht(summary.income)}</span>
        </span>
        <span className="text-gray-400">
          รายจ่าย <span className="text-gray-200 tabular-nums">{baht(summary.totalExpense)}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#26262A]">
        {chips.map(([group, icon, label]) => (
          <div key={group} className="text-center">
            <p className="text-sm mb-0.5">{icon}</p>
            <p className="text-xs font-medium text-gray-200 tabular-nums">
              {summary.byGroup[group].toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-[0.65rem] text-gray-600">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** หัวกลุ่มที่กดพับ/กางได้ */
function GroupHeader({
  icon: Icon,
  label,
  total,
  open,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#1F1F22] transition-colors"
    >
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="flex-1 font-medium text-white">{label}</span>
      <span className="text-white font-semibold tabular-nums">{baht(total)}</span>
      {open ? (
        <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
      ) : (
        <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
      )}
    </button>
  );
}

/** ปุ่มเพิ่มรายการ */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00B900] border border-dashed border-[#333338] hover:border-[#00B900]/50 rounded-lg px-3 py-2 transition-colors ml-auto"
    >
      <Plus className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/** แถวรายการใช้จ่าย 1 บรรทัด พร้อมป้ายเลือกคน และเมนูแก้ไข/ลบ */
function ExpenseRow({
  icon,
  title,
  sub,
  amount,
  members,
  sharedBy,
  onShare,
  onEdit,
  onDelete,
  extraAction,
}: {
  icon?: string | null;
  title: string;
  sub?: string | null;
  amount: number;
  members: FinanceMember[];
  sharedBy: string[];
  onShare: (memberIds: string[]) => Promise<{ success: boolean; error?: string }>;
  onEdit: () => void;
  onDelete: () => void;
  /** เมนูเสริม เช่น "แปลงเป็นรายการผ่อน" (เฉพาะรายการในบัตร) */
  extraAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-base w-5 text-center shrink-0">{icon || '•'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{title}</p>
        {sub && <p className="text-xs text-gray-600">{sub}</p>}
      </div>
      <span className="text-sm text-gray-200 tabular-nums shrink-0">{baht(amount)}</span>
      <MemberPicker
        members={members}
        sharedBy={sharedBy}
        amount={amount}
        onChange={onShare}
        itemLabel={title}
      />
      <RowMenu
        itemLabel={title}
        onEdit={onEdit}
        onDelete={onDelete}
        deleteLabel="ลบรายการ"
        extraAction={extraAction}
      />
    </div>
  );
}

/** สรุป "ใครจ่ายเท่าไร" ใช้ท้ายบัตรและกลุ่มเงินสด */
function SplitLine({ data, totals }: { data: FinanceMonth; totals: Record<string, number> }) {
  // ยอดที่ยังไม่ได้ระบุว่าใครรับผิดชอบ — แสดงด้วยเพื่อให้ผลรวมตรงกับยอดบัตร
  const unassigned = totals['__unassigned__'] || 0;

  return (
    <div className="flex items-stretch gap-2 w-full">
      {data.members.map(m => (
        <div
          key={m.id}
          className="flex-1 min-w-0 rounded-lg bg-[#1F1F22] px-2.5 py-1.5 text-center"
        >
          <p className="text-[0.65rem] text-gray-500 truncate">{m.name}</p>
          <p className="text-sm font-semibold text-gray-100 tabular-nums">
            {baht(totals[m.id] || 0)}
          </p>
        </div>
      ))}

      {unassigned > 0 && (
        <div className="flex-1 min-w-0 rounded-lg bg-[#F5A524]/10 border border-[#F5A524]/25 px-2.5 py-1.5 text-center">
          <p className="text-[0.65rem] text-[#F5A524] truncate">ยังไม่ระบุ</p>
          <p className="text-sm font-semibold text-[#F5A524] tabular-nums">
            {baht(unassigned)}
          </p>
        </div>
      )}
    </div>
  );
}

interface FinanceBoardProps {
  data: FinanceMonth;
}

/** โมดัลที่กำลังเปิด — null คือไม่มีโมดัลเปิดอยู่ */
type ModalState =
  | null
  | { kind: 'income'; member: FinanceMember }
  | { kind: 'card'; card?: CreditCardType }
  | { kind: 'expense'; channel: 'credit_card' | 'cash'; cardId?: string; cardLabel?: string; expense?: ExpenseItem }
  | { kind: 'installment'; cardId: string; cardLabel: string; installment?: InstallmentType }
  | { kind: 'recurring'; expense?: ExpenseItem }
  | { kind: 'import'; cardId?: string }
  | { kind: 'convert'; expense: ExpenseItem };

export default function FinanceBoard({ data }: FinanceBoardProps) {
  const router = useRouter();
  const summaries = summarizeMembers(data);
  const [, startDeleting] = useTransition();

  // กลุ่มไหนกางอยู่ — เปิดกลุ่มบัตรเครดิตไว้ก่อนเพราะเป็นกลุ่มที่ซ้อนหลายชั้น
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    credit_card: true,
  });
  // กางบัตรใบแรกไว้ให้เห็นรายการโดยไม่ต้องกด — ใบที่เหลือพับไว้
  const [openCards, setOpenCards] = useState<Record<string, boolean>>(() =>
    data.cards.length > 0 ? { [data.cards[0].id]: true } : {}
  );

  const toggleGroup = (id: string) =>
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleCard = (id: string) =>
    setOpenCards(prev => ({ ...prev, [id]: !prev[id] }));

  // โมดัลที่เปิดอยู่ — เก็บเป็นก้อนเดียวเพื่อให้เปิดได้ทีละใบ
  const [modal, setModal] = useState<ModalState>(null);
  const closeModal = () => setModal(null);

  /** ลบรายการ ยืนยันก่อนเสมอ แล้วรีเฟรชหน้า */
  const confirmDelete = (
    label: string,
    action: () => Promise<{ success: boolean; error?: string }>
  ) => {
    if (!window.confirm(`ลบ "${label}" ใช่ไหม?`)) return;
    startDeleting(async () => {
      const result = await action();
      if (result.success) {
        toast.success('ลบแล้ว');
        router.refresh();
      } else {
        toast.error(result.error || 'ลบไม่สำเร็จ');
      }
    });
  };

  /** วันที่ตั้งต้นของฟอร์ม — วันที่ 1 ของเดือนที่กำลังดู */
  const defaultDate = `${data.month}-01`;

  /**
   * บัตรที่ใกล้ครบชำระที่สุด และยังอยู่ในช่วงเตือนล่วงหน้าของบัตรใบนั้น
   * คิดจากวันจริงเทียบกับ remindBeforeDays ไม่ได้ fix ไว้ที่ใบใดใบหนึ่ง
   */
  const dueSoon = data.cards
    .map(card => ({ card, daysLeft: card.daysUntilDue }))
    .filter(({ card, daysLeft }) => daysLeft <= card.remindBeforeDays)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">การเงิน</h1>
        <span className="text-sm text-gray-500">{formatMonthLabel(data.month)}</span>
      </header>

      {/* แจ้งเตือนบัตรใกล้ครบชำระ — ซ่อนเมื่อไม่มีบัตรใบไหนเข้าช่วงเตือน */}
      {dueSoon && (
        <div className="flex items-center gap-3 bg-[#F5A524]/10 border border-[#F5A524]/30 rounded-xl p-3.5 mb-6">
          <Bell className="w-4 h-4 text-[#F5A524] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">
              {dueSoon.card.name}
              {dueSoon.card.last4 && ` ••••${dueSoon.card.last4}`}{' '}
              {dueSoon.daysLeft === 0
                ? 'ครบชำระวันนี้'
                : `ครบชำระอีก ${dueSoon.daysLeft} วัน`}
            </p>
            <p className="text-xs text-gray-500">
              {dueSoon.card.dueDayOfMonth >= 32
                ? 'ทุกสิ้นเดือน'
                : `วันที่ ${dueSoon.card.dueDayOfMonth} ของเดือน`}
            </p>
          </div>
          <span className="text-sm font-semibold text-[#F5A524] tabular-nums">
            {baht(cardTotal(data, dueSoon.card.id))}
          </span>
        </div>
      )}

      {/* การ์ดสรุปรายคน */}
      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        {summaries.map(s => (
          <MemberCard
            key={s.member.id}
            summary={s}
            onEdit={() => setModal({ kind: 'income', member: s.member })}
          />
        ))}
      </div>

      {/* รายจ่าย */}
      <div className="flex items-center justify-between mb-3 px-1 gap-3">
        <h2 className="text-sm font-medium text-gray-400">รายจ่ายทั้งหมด</h2>
        <div className="flex items-center gap-3">
          {data.cards.length > 0 && (
            <button
              type="button"
              onClick={() => setModal({ kind: 'import' })}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00B900] transition-colors"
            >
              <FileUp className="w-3.5 h-3.5" />
              อ่านจากไฟล์
            </button>
          )}
          <span className="text-sm text-gray-300 font-semibold tabular-nums">
            {baht(grandTotal(data))}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* === บัตรเครดิต === */}
        <div className="bg-[#161618] border border-[#26262A] rounded-xl">
          <GroupHeader
            icon={CreditCard}
            label="บัตรเครดิต"
            total={groupTotal(data, 'credit_card')}
            open={!!openGroups.credit_card}
            onToggle={() => toggleGroup('credit_card')}
          />

          {openGroups.credit_card && (
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#26262A] pt-3">
              {data.cards.map(card => {
                const isOpen = !!openCards[card.id];
                const split = cardTotalByMember(data, card.id);
                const items = cardExpenses(data, card.id);
                const installments = cardInstallments(data, card.id);
                const cardLabel = `${card.name}${card.last4 ? ` ••••${card.last4}` : ''}`;

                return (
                  <div
                    key={card.id}
                    className="border border-[#26262A] rounded-xl"
                  >
                    {/* หัวบัตร — กดเพื่อกาง มีเมนูจัดการมุมขวา */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => toggleCard(card.id)}
                        aria-expanded={isOpen}
                        className="w-full text-left p-4 hover:bg-[#1F1F22] transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2 pr-8">
                          <span className="text-sm text-white">
                            {card.name}
                            {card.last4 && (
                              <span className="text-gray-500"> ••••{card.last4}</span>
                            )}
                          </span>
                          <MemberTag name={memberName(data, card.ownerId)} />
                        </div>

                        <p className="text-xl font-bold text-white tabular-nums mb-2">
                          {baht(cardTotal(data, card.id))}
                        </p>

                        <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                          <Bell className="w-3 h-3" />
                          ครบชำระ {formatShortDate(card.cycleTo)}
                          {card.daysUntilDue >= 0 && ` · อีก ${card.daysUntilDue} วัน`}
                        </p>
                        <p className="text-[0.65rem] text-gray-600 mb-2">
                          {cardRange(items)} · {items.length + installments.length} รายการ
                        </p>

                        <div className="flex items-center gap-2 pt-2 border-t border-[#26262A]">
                          <SplitLine data={data} totals={split} />
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                          )}
                        </div>
                      </button>

                      {/* เมนูวางทับมุมขวาบน ไม่ซ้อนในปุ่มกาง เพราะปุ่มซ้อนปุ่มไม่ได้ */}
                      <div className="absolute top-3.5 right-3.5">
                        <RowMenu
                          itemLabel={cardLabel}
                          deleteLabel="ลบบัตร"
                          onEdit={() => setModal({ kind: 'card', card })}
                          onDelete={() =>
                            confirmDelete(
                              `บัตร ${cardLabel} (มีรายการผูกอยู่ ${items.length + installments.length} รายการ)`,
                              () => deleteCard(card.id)
                            )
                          }
                        />
                      </div>
                    </div>

                    {isOpen && (
                      <div className="px-4 pb-3 border-t border-[#26262A]">
                        {/* รายการผ่อนของบัตรใบนี้ */}
                        {installments.length > 0 && (
                          <div className="pt-3 flex flex-col gap-2">
                            {installments.map(inst => {
                              // งวดคำนวณสดจากเดือนที่เริ่มผ่อนเทียบกับเดือนที่กำลังดู
                              // เลขจึงเดินเองทุกเดือน และย้อนดูเดือนเก่าก็ได้เลขของเดือนนั้น
                              const progress = installmentProgress(inst, data.month);
                              const oneTime = progress.isOneTime;

                              return (
                                <div
                                  key={inst.id}
                                  className="bg-[#1A1A1D] border border-[#26262A] rounded-lg p-3"
                                >
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-sm shrink-0">{inst.icon || '💳'}</span>
                                    <span className="text-sm text-white flex-1 truncate">
                                      {inst.title}
                                    </span>
                                    <MemberPicker
                                      members={data.members}
                                      sharedBy={inst.sharedBy}
                                      amount={inst.monthlyAmount}
                                      onChange={memberIds =>
                                        setShares('installment', inst.id, memberIds)
                                      }
                                      itemLabel={inst.title}
                                    />
                                    <RowMenu
                                      itemLabel={inst.title}
                                      deleteLabel="ลบรายการผ่อน"
                                      onEdit={() =>
                                        setModal({ kind: 'installment', cardId: card.id, cardLabel, installment: inst })
                                      }
                                      onDelete={() => confirmDelete(inst.title, () => deleteInstallment(inst.id))}
                                    />
                                  </div>

                                  {oneTime ? (
                                    <div className="flex items-baseline justify-between">
                                      <span className="text-base font-semibold text-white tabular-nums">
                                        {baht(inst.monthlyAmount)}
                                      </span>
                                      <span className="text-xs text-gray-500">จ่ายครั้งเดียว</span>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-base font-semibold text-white tabular-nums mb-1.5">
                                        {baht(inst.monthlyAmount)}
                                        <span className="text-xs font-normal text-gray-500">
                                          {' '}
                                          / เดือน
                                        </span>
                                      </p>
                                      <ProgressBar percent={progress.percent} />
                                      <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500 tabular-nums">
                                        <span>
                                          งวด {progress.currentInstallment}/{inst.totalInstallments}
                                        </span>
                                        <span>เหลืออีก {progress.remainingInstallments} งวด</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* รายการใช้จ่ายของบัตรใบนี้ */}
                        <div className="divide-y divide-[#26262A]">
                          {items.map(e => (
                            <ExpenseRow
                              key={e.id}
                              icon={e.icon}
                              title={e.title}
                              sub={shortDate(e.date)}
                              amount={e.amount}
                              members={data.members}
                              sharedBy={e.sharedBy}
                              onShare={memberIds => setShares('expense', e.id, memberIds)}
                              extraAction={{
                                label: 'แปลงเป็นรายการผ่อน',
                                onClick: () => setModal({ kind: 'convert', expense: e }),
                              }}
                              onEdit={() =>
                                setModal({ kind: 'expense', channel: 'credit_card', cardId: card.id, cardLabel, expense: e })
                              }
                              onDelete={() => confirmDelete(e.title, () => deleteExpense(e.id))}
                            />
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setModal({ kind: 'import', cardId: card.id })}
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#00B900] border border-dashed border-[#333338] hover:border-[#00B900]/50 rounded-lg px-3 py-2 transition-colors mr-auto"
                          >
                            <FileUp className="w-3.5 h-3.5" />
                            อ่านจากไฟล์
                          </button>
                          <AddButton
                            label="เพิ่มผ่อน"
                            onClick={() => setModal({ kind: 'installment', cardId: card.id, cardLabel })}
                          />
                          <AddButton
                            label="เพิ่มรายการ"
                            onClick={() =>
                              setModal({ kind: 'expense', channel: 'credit_card', cardId: card.id, cardLabel })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex">
                <AddButton label="เพิ่มบัตร" onClick={() => setModal({ kind: 'card' })} />
              </div>
            </div>
          )}
        </div>

        {/* === เงินสด === */}
        <div className="bg-[#161618] border border-[#26262A] rounded-xl">
          <GroupHeader
            icon={Banknote}
            label="เงินสด"
            total={groupTotal(data, 'cash')}
            open={!!openGroups.cash}
            onToggle={() => toggleGroup('cash')}
          />

          {openGroups.cash && (
            <div className="px-4 pb-3 border-t border-[#26262A] pt-3">
              <div className="pb-2 mb-1 border-b border-[#26262A]">
                <SplitLine data={data} totals={groupTotalByMember(data, 'cash')} />
              </div>
              <div className="divide-y divide-[#26262A]">
                {data.expenses
                  .filter(e => e.group === 'cash')
                  .map(e => (
                    <ExpenseRow
                      key={e.id}
                      icon={e.icon}
                      title={e.title}
                      sub={shortDate(e.date)}
                      amount={e.amount}
                      members={data.members}
                      sharedBy={e.sharedBy}
                      onShare={memberIds => setShares('expense', e.id, memberIds)}
                      onEdit={() => setModal({ kind: 'expense', channel: 'cash', expense: e })}
                      onDelete={() => confirmDelete(e.title, () => deleteExpense(e.id))}
                    />
                  ))}
              </div>
              <div className="flex pt-2">
                <AddButton
                  label="เพิ่มรายการ"
                  onClick={() => setModal({ kind: 'expense', channel: 'cash' })}
                />
              </div>
            </div>
          )}
        </div>

        {/* === ค่าใช้จ่ายประจำ === */}
        <div className="bg-[#161618] border border-[#26262A] rounded-xl">
          <GroupHeader
            icon={Home}
            label="ค่าใช้จ่ายประจำ"
            total={groupTotal(data, 'recurring')}
            open={!!openGroups.recurring}
            onToggle={() => toggleGroup('recurring')}
          />

          {openGroups.recurring && (
            <div className="px-4 pb-3 border-t border-[#26262A] pt-3">
              <div className="divide-y divide-[#26262A]">
                {data.expenses
                  .filter(e => e.group === 'recurring')
                  .map(e => (
                    <ExpenseRow
                      key={e.id}
                      icon={e.icon}
                      title={e.title}
                      sub={e.dayOfMonth ? `ทุกวันที่ ${e.dayOfMonth}` : null}
                      amount={e.amount}
                      members={data.members}
                      sharedBy={e.sharedBy}
                      onShare={memberIds => setShares('recurring', e.id, memberIds)}
                      onEdit={() => setModal({ kind: 'recurring', expense: e })}
                      onDelete={() =>
                        confirmDelete(
                          `${e.title} (จะหายจากทุกเดือน)`,
                          () => deleteRecurring(e.id)
                        )
                      }
                    />
                  ))}
              </div>
              <div className="flex pt-2">
                <AddButton
                  label="เพิ่มรายการ"
                  onClick={() => setModal({ kind: 'recurring' })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* โมดัลทั้งหมด — เปิดได้ทีละใบตามสถานะเดียว */}
      {modal?.kind === 'income' && (
        <IncomeModal member={modal.member} period={data.month} onClose={closeModal} />
      )}

      {modal?.kind === 'card' && (
        <CardModal members={data.members} card={modal.card} onClose={closeModal} />
      )}

      {modal?.kind === 'expense' && (
        <ExpenseModal
          members={data.members}
          channel={modal.channel}
          cardId={modal.cardId}
          cardLabel={modal.cardLabel}
          expense={modal.expense}
          defaultDate={defaultDate}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'installment' && (
        <InstallmentModal
          members={data.members}
          cardId={modal.cardId}
          cardLabel={modal.cardLabel}
          installment={modal.installment}
          defaultMonth={data.month}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'recurring' && (
        <RecurringModal
          members={data.members}
          expense={modal.expense}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'convert' && (
        <ConvertToInstallmentModal
          expense={modal.expense}
          defaultMonth={data.month}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'import' && (
        <StatementImport
          cards={data.cards}
          defaultCardId={modal.cardId}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
