'use client';

import { useState, useTransition } from 'react';
import {
  ChevronRight,
  ChevronDown,
  CreditCard,
  Banknote,
  Home,
  Bell,
  ChevronLeft,
  Plus,
  AlertTriangle,
  FileUp,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import RowMenu from './RowMenu';
import MemberPicker from './MemberPicker';
import CategoryIcon from './CategoryIcon';
import BulkAssignBar from './BulkAssignBar';
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
  cardsOfOwner,
  cardDebts,
  ownerCardTotal,
  ownerCardTotalByMember,
  sharedTotal,
  sharedTotalByMember,
  unassignedTotal,
  grandTotal,
  installmentProgress,
  defaultDateFor,
  formatMonthLabel,
  shiftMonth,
  toBuddhistYear,
} from '@/lib/finance/calc';
import type {
  CreditCard as CreditCardType,
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

/**
 * สีประจำตัวคน — ใช้แยกว่าบล็อกไหนของใครโดยไม่ต้องอ่านชื่อ
 *
 * ไล่ตามลำดับในบ้าน วนซ้ำเมื่อคนเกินจำนวนสี เลี่ยงเขียว #00B900 ที่เป็นสีหลักของแอป
 * และแดง #F0384E ที่ใช้สื่อว่าเกินงบ
 */
const MEMBER_COLORS = [
  { accent: '#4D9FFF', soft: 'rgba(77,159,255,0.12)', border: 'rgba(77,159,255,0.3)' },
  { accent: '#C77DFF', soft: 'rgba(199,125,255,0.12)', border: 'rgba(199,125,255,0.3)' },
  { accent: '#FFB84D', soft: 'rgba(255,184,77,0.12)', border: 'rgba(255,184,77,0.3)' },
  { accent: '#4DD9C0', soft: 'rgba(77,217,192,0.12)', border: 'rgba(77,217,192,0.3)' },
] as const;

function memberColor(data: FinanceMonth, memberId: string) {
  const index = data.members.findIndex(m => m.id === memberId);
  return MEMBER_COLORS[(index < 0 ? 0 : index) % MEMBER_COLORS.length];
}

/** จุดสีประจำตัวคน */
function MemberDot({ color }: { color: string }) {
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

/** ป้ายชื่อคน — ใส่สีประจำตัวเมื่อรู้ว่าเป็นใคร */
function MemberTag({ name, color }: { name: string; color?: (typeof MEMBER_COLORS)[number] }) {
  if (!color) {
    return (
      <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-[#26262A] text-gray-400 shrink-0">
        {name}
      </span>
    );
  }
  return (
    <span
      className="text-[0.65rem] px-1.5 py-0.5 rounded shrink-0 inline-flex items-center gap-1 border"
      style={{
        backgroundColor: color.soft,
        borderColor: color.border,
        color: color.accent,
      }}
    >
      <MemberDot color={color.accent} />
      {name}
    </span>
  );
}

/**
 * บรรทัดแตกยอดว่าเป็นของใครเท่าไร
 *
 * ซ่อนคนที่ยอดเป็นศูนย์ เพราะบ้านหลายคนจะทำให้บรรทัดยาวล้นจอมือถือ
 * ทั้งที่ปกติไม่ใช่ทุกคนมียอดในทุกบัตร
 */
function ShareBreakdown({
  data,
  totals,
  className = '',
}: {
  data: FinanceMonth;
  totals: Record<string, number>;
  className?: string;
}) {
  const parts = data.members
    .filter(m => (totals[m.id] || 0) > 0)
    .map(m => ({ id: m.id, name: m.name, amount: totals[m.id] }));

  const unassigned = totals['__unassigned__'] || 0;

  if (parts.length === 0 && unassigned === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${className}`}>
      {parts.map(p => (
        <span
          key={p.id}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
          style={{ backgroundColor: memberColor(data, p.id).soft }}
        >
          <MemberDot color={memberColor(data, p.id).accent} />
          <span style={{ color: memberColor(data, p.id).accent }}>{p.name}</span>
          <span className="text-gray-200 tabular-nums">{baht(p.amount)}</span>
        </span>
      ))}
      {unassigned > 0 && (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-[#F5A524]/10 text-[#F5A524]">
          ยังไม่ระบุ <span className="tabular-nums">{baht(unassigned)}</span>
        </span>
      )}
    </div>
  );
}

/**
 * สรุปว่าใครต้องจ่ายคืนใครเท่าไร จากการไปใช้ยอดในบัตรคนอื่น
 *
 * กางดูได้ว่ามาจากบัตรไหน รายการไหนบ้าง เพราะเวลาโอนเงินคืนกันจริง
 * ต้องตรวจสอบได้ว่ายอดนี้มาจากอะไร
 */
function SettlementBlock({ data }: { data: FinanceMonth }) {
  const debts = cardDebts(data);
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (debts.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[#26262A] flex flex-col gap-2">
      <p className="text-xs text-gray-500">ต้องจ่ายคืนกัน</p>

      {debts.map(debt => {
        const key = `${debt.debtorId}→${debt.creditorId}`;
        const isOpen = openKey === key;
        const debtor = memberColor(data, debt.debtorId);
        const creditor = memberColor(data, debt.creditorId);

        return (
          <div
            key={key}
            className={`rounded-lg bg-[#0F0F11]/60 border overflow-hidden transition-colors ${
              isOpen ? 'border-[#3A3A40]' : 'border-[#2E2E33]'
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : key)}
              aria-expanded={isOpen}
              className="group w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#1F1F22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 min-w-0 flex-1 text-sm">
                <MemberDot color={debtor.accent} />
                <span style={{ color: debtor.accent }} className="truncate">
                  {memberName(data, debt.debtorId)}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <MemberDot color={creditor.accent} />
                <span style={{ color: creditor.accent }} className="truncate">
                  {memberName(data, debt.creditorId)}
                </span>
              </span>
              <span className="text-base font-bold text-white tabular-nums shrink-0">
                {baht(debt.amount)}
              </span>
              {/* บอกเป็นคำว่ากดได้ ไม่ใช่แค่ลูกศรจางๆ ที่มองไม่ออกว่าเป็นปุ่ม */}
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[#3A3A40] bg-[#1F1F22] text-gray-300 shrink-0 group-hover:border-[#00B900]/50 group-hover:text-[#00B900] transition-colors">
                {isOpen ? (
                  <>
                    ซ่อน
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    {debt.items.length} รายการ
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </span>
            </button>

            {isOpen && (
              <div className="px-3 pb-2.5 pt-1 border-t border-[#2E2E33] bg-[#161618]">
                <p className="text-[0.65rem] text-gray-600 mb-1.5">
                  {debt.items.length} รายการที่{memberName(data, debt.debtorId)}ใช้ในบัตรของ
                  {memberName(data, debt.creditorId)}
                </p>
                <div className="divide-y divide-[#26262A]">
                  {debt.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5">
                      <CategoryIcon icon={item.icon} className="w-3.5 h-3.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-200 truncate">{item.title}</p>
                        <p className="text-[0.65rem] text-gray-600 truncate">
                          {item.cardName}
                          {item.date && ` · ${shortDate(item.date)}`}
                          {/* ยอดเต็มต่างจากยอดที่ต้องคืน = รายการนี้หารกับคนอื่นด้วย */}
                          {item.fullAmount !== item.amount &&
                            ` · หารจาก ${baht(item.fullAmount)}`}
                        </p>
                      </div>
                      <span className="text-xs text-gray-200 tabular-nums shrink-0">
                        {baht(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** บล็อกภาพรวมของคนหนึ่งคน — รายรับ คงเหลือ และบัตรที่ตัวเองถือ */
function OverviewMember({
  data,
  summary,
  onEdit,
}: {
  data: FinanceMonth;
  summary: ReturnType<typeof summarizeMembers>[number];
  onEdit: () => void;
}) {
  const over = summary.remaining < 0;
  const cards = cardsOfOwner(data, summary.member.id);
  const ownerTotal = ownerCardTotal(data, summary.member.id);
  const color = memberColor(data, summary.member.id);
  // มีหลายใบถึงจะต้องกางดู ใบเดียวยอดก็เท่ากับยอดรวมอยู่แล้ว
  const [showCards, setShowCards] = useState(cards.length > 1);

  return (
    <div
      className="rounded-xl border-l-4 p-4"
      style={{ borderLeftColor: color.accent, backgroundColor: color.soft }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3
            className="font-semibold truncate flex items-center gap-2"
            style={{ color: color.accent }}
          >
            <MemberDot color={color.accent} />
            {summary.member.name}
          </h3>
          <p className="text-[0.65rem] text-gray-500 mt-0.5">รายจ่ายรวม</p>
          <p className="text-xl font-bold text-white tabular-nums">
            {baht(summary.totalExpense)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-2">
            {over && (
              <span className="flex items-center gap-1 text-xs text-[#F0384E]">
                <AlertTriangle className="w-3.5 h-3.5" />
                เกินงบ
              </span>
            )}
            <button
              type="button"
              onClick={onEdit}
              className="text-xs px-2 py-1 rounded-md border border-[#3A3A40] bg-[#1F1F22] text-gray-300 hover:text-[#00B900] hover:border-[#00B900]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer"
            >
              แก้รายรับ
            </button>
          </div>
          {/* รายรับกับคงเหลือเป็นข้อมูลประกอบ ย่อไว้ไม่ให้แย่งสายตาจากยอดรายจ่าย */}
          <p className="text-[0.65rem] text-gray-600 mt-1.5 tabular-nums">
            รายรับ {baht(summary.income)}
          </p>
          <p
            className={`text-[0.65rem] tabular-nums ${
              over ? 'text-[#F0384E]' : 'text-gray-600'
            }`}
          >
            คงเหลือ {over ? '-' : ''}
            {baht(Math.abs(summary.remaining))}
          </p>
        </div>
      </div>

      <ProgressBar percent={summary.usedPercent} danger={over} />
      <p className="text-[0.65rem] text-gray-500 mt-1 mb-3 tabular-nums">
        {summary.usedPercent}% ใช้ไปแล้ว
      </p>

      {/* ยอดรวมก่อน กางดูรายบัตรได้เมื่อต้องการ — รายการข้างในอยู่กล่องล่าง */}
      {cards.length > 0 && (
        <div className="pt-2 border-t border-[#26262A]">
          <button
            type="button"
            onClick={() => setShowCards(v => !v)}
            aria-expanded={showCards}
            className="group w-full flex items-baseline justify-between gap-3 text-left cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-xs text-gray-400 group-hover:text-[#00B900] transition-colors">
              <CreditCard className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#00B900] transition-colors" />
              {cards.length} บัตร
              {showCards ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </span>
            <span className="text-xs font-semibold text-gray-100 tabular-nums">
              {baht(ownerTotal)}
            </span>
          </button>

          <ShareBreakdown
            data={data}
            totals={ownerCardTotalByMember(data, summary.member.id)}
            className="mt-1"
          />

          {showCards && (
            <div className="flex flex-col gap-2 mt-2.5">
              {cards.map(card => (
                <div
                  key={card.id}
                  className="rounded-lg bg-[#0F0F11]/60 border border-[#2E2E33] px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <CreditCard className="w-3.5 h-3.5 text-gray-500 shrink-0 self-center" />
                      <span className="text-xs text-gray-300 truncate">
                        {card.name}
                        {card.last4 && (
                          <span className="text-gray-600"> ••••{card.last4}</span>
                        )}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-gray-200 tabular-nums shrink-0">
                      {baht(cardTotal(data, card.id))}
                    </span>
                  </div>
                  <ShareBreakdown
                    data={data}
                    totals={cardTotalByMember(data, card.id)}
                    className="mt-1.5"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** กล่องภาพรวม — บัตรของใครของมัน รายจ่ายร่วม และยอดรวมรายคน */
function OverviewBox({
  data,
  summaries,
  onEditIncome,
  onFixUnassigned,
}: {
  data: FinanceMonth;
  summaries: ReturnType<typeof summarizeMembers>;
  onEditIncome: (member: FinanceMember) => void;
  /** ติ๊กรายการที่ยังไม่ระบุคนหารให้ทั้งหมด เพื่อกำหนดทีเดียว */
  onFixUnassigned: () => void;
}) {
  const shared = sharedTotal(data);
  const sharedByMember = sharedTotalByMember(data);
  const unassigned = unassignedTotal(data);

  return (
    <div className="bg-[#161618] border border-[#26262A] rounded-2xl p-5 mb-3">
      <h2 className="text-sm font-medium text-gray-400 mb-3">ภาพรวมรายจ่าย</h2>

      {/* รายการที่ไม่ระบุคนหารทำให้ยอดทุกบรรทัดยังไม่ครบ จึงเตือนไว้บนสุด */}
      {unassigned.count > 0 && (
        <button
          type="button"
          onClick={onFixUnassigned}
          className="w-full flex items-center gap-2.5 mb-3 px-3 py-2.5 rounded-lg bg-[#F5A524]/10 border border-[#F5A524]/30 hover:border-[#F5A524]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5A524]/60 transition-colors cursor-pointer text-left"
        >
          <AlertTriangle className="w-4 h-4 text-[#F5A524] shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm text-[#F5A524]">
              {unassigned.count} รายการยังไม่ระบุคนหาร
            </span>
            <span className="block text-[0.65rem] text-[#F5A524]/70 tabular-nums">
              {baht(unassigned.amount)} ยังไม่เข้าสูตรคำนวณ
            </span>
          </span>
          <span className="text-xs px-2 py-1 rounded-md border border-[#F5A524]/40 text-[#F5A524] shrink-0">
            จัดการ
          </span>
        </button>
      )}

      <div className="flex flex-col gap-3">
        {summaries.map(s => (
          <OverviewMember
            key={s.member.id}
            data={data}
            summary={s}
            onEdit={() => onEditIncome(s.member)}
          />
        ))}
      </div>

      {shared > 0 && (
        <div className="pt-4 mt-4 border-t border-[#26262A]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <Banknote className="w-3.5 h-3.5 text-gray-500" />
              เงินสด
              <span className="text-gray-700">+</span>
              <Home className="w-3.5 h-3.5 text-gray-500" />
              ประจำ
            </span>
            <span className="text-xs text-gray-200 tabular-nums">{baht(shared)}</span>
          </div>
          <ShareBreakdown data={data} totals={sharedByMember} className="mt-1" />
        </div>
      )}

      <div className="pt-4 mt-4 border-t-2 border-[#2F2F34]">
        <p className="text-xs text-gray-500 mb-2">สรุป — รวมเป็นของแต่ละคน</p>
        <div className="flex flex-col gap-1.5">
          {summaries.map(s => {
            const color = memberColor(data, s.member.id);
            return (
              <div
                key={s.member.id}
                className="flex items-baseline justify-between gap-3 rounded-lg border-l-4 px-2.5 py-1.5"
                style={{ borderLeftColor: color.accent, backgroundColor: color.soft }}
              >
                <span
                  className="text-sm flex items-center gap-2"
                  style={{ color: color.accent }}
                >
                  <MemberDot color={color.accent} />
                  {s.member.name}
                </span>
                <span className="text-base font-semibold text-white tabular-nums">
                  {baht(s.totalExpense)}
                </span>
              </div>
            );
          })}
          <div className="flex items-baseline justify-between gap-3 pt-2.5 mt-1 border-t border-[#26262A]">
            <span className="text-sm text-gray-400">รวมทั้งหมด</span>
            <span className="text-2xl font-bold text-white tabular-nums">
              {baht(grandTotal(data))}
            </span>
          </div>
        </div>
      </div>

      <SettlementBlock data={data} />
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
  accentColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  total: number;
  open: boolean;
  onToggle: () => void;
  /** สีประจำตัวเจ้าของ — ใส่เฉพาะกลุ่มที่ผูกกับคน */
  accentColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="group w-full flex items-center gap-3 p-4 text-left hover:bg-[#1F1F22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer"
    >
      <span style={accentColor ? { color: accentColor } : undefined}>
        <Icon className={`w-4 h-4 shrink-0 ${accentColor ? '' : 'text-gray-400'}`} />
      </span>
      <span
        className={`flex-1 font-medium ${accentColor ? '' : 'text-white'}`}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {label}
      </span>
      <span className="text-white font-semibold tabular-nums">{baht(total)}</span>
      <span className="flex items-center justify-center w-7 h-7 rounded-md border border-[#3A3A40] bg-[#1F1F22] text-gray-300 shrink-0 group-hover:border-[#00B900]/50 group-hover:text-[#00B900] transition-colors">
        {open ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </span>
    </button>
  );
}

/** ปุ่มเพิ่มรายการ */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-[#00B900] border border-dashed border-[#4A4A52] hover:border-[#00B900]/60 hover:bg-[#00B900]/5 rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors ml-auto cursor-pointer"
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
  selectable,
  selected,
  onToggleSelect,
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
  /** แสดงช่องติ๊กเพื่อเลือกหลายรายการพร้อมกัน */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 py-2.5 ${
        selected ? 'bg-[#00B900]/5' : ''
      }`}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onToggleSelect}
          aria-label={`เลือก ${title}`}
          className="w-4 h-4 shrink-0 accent-[#00B900] cursor-pointer"
        />
      )}
      <span className="w-5 flex justify-center shrink-0">
        <CategoryIcon icon={icon} />
      </span>
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

/**
 * สรุป "ใครจ่ายเท่าไร" ใช้ท้ายบัตรและกลุ่มเงินสด
 *
 * ซ่อนคนที่ยอดเป็นศูนย์ เพื่อให้เห็นชัดว่าบัตรใบนี้มีใครเกี่ยวข้องบ้างจริงๆ
 */
function SplitLine({ data, totals }: { data: FinanceMonth; totals: Record<string, number> }) {
  // ยอดที่ยังไม่ได้ระบุว่าใครรับผิดชอบ — แสดงด้วยเพื่อให้ผลรวมตรงกับยอดบัตร
  const unassigned = totals['__unassigned__'] || 0;
  const active = data.members.filter(m => (totals[m.id] || 0) > 0);

  if (active.length === 0 && unassigned === 0) return null;

  return (
    // บ้านหลายคนให้ขึ้นบรรทัดใหม่แทนการบีบช่องจนตัวเลขเบียดกันบนมือถือ
    <div className="flex flex-wrap items-stretch gap-2 w-full">
      {active.map(m => (
        <div
          key={m.id}
          className="flex-1 min-w-[6.5rem] rounded-lg border px-2.5 py-1.5"
          style={{
            borderColor: memberColor(data, m.id).border,
            backgroundColor: memberColor(data, m.id).soft,
          }}
        >
          <p
            className="text-[0.65rem] truncate flex items-center gap-1"
            style={{ color: memberColor(data, m.id).accent }}
          >
            <MemberDot color={memberColor(data, m.id).accent} />
            {m.name}
          </p>
          <p className="text-sm font-semibold text-gray-100 tabular-nums">
            {baht(totals[m.id] || 0)}
          </p>
        </div>
      ))}

      {unassigned > 0 && (
        <div className="flex-1 min-w-[6.5rem] rounded-lg bg-[#F5A524]/10 border border-dashed border-[#F5A524]/40 px-2.5 py-1.5">
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
  | { kind: 'card'; card?: CreditCardType; defaultOwnerId?: string }
  | { kind: 'expense'; channel: 'credit_card' | 'cash'; cardId?: string; cardLabel?: string; expense?: ExpenseItem }
  | { kind: 'installment'; cardId: string; cardLabel: string; installment?: InstallmentType }
  | { kind: 'recurring'; expense?: ExpenseItem }
  | { kind: 'import'; cardId?: string }
  | { kind: 'convert'; expense: ExpenseItem };

export default function FinanceBoard({ data }: FinanceBoardProps) {
  const router = useRouter();
  const summaries = summarizeMembers(data);
  const [, startDeleting] = useTransition();

  // กลุ่มไหนกางอยู่ — เงินสดกับประจำพับไว้ก่อน
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // กางบล็อกบัตรของทุกคนไว้ก่อน เพราะเป็นส่วนที่ใช้บ่อยที่สุด
  const [openOwners, setOpenOwners] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.members.map(m => [m.id, true]))
  );
  // กางบัตรใบแรกไว้ให้เห็นรายการโดยไม่ต้องกด — ใบที่เหลือพับไว้
  const [openCards, setOpenCards] = useState<Record<string, boolean>>(() =>
    data.cards.length > 0 ? { [data.cards[0].id]: true } : {}
  );

  // รายการที่ติ๊กไว้เพื่อกำหนดผู้ร่วมหารพร้อมกันหลายรายการ
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // ประจำอยู่คนละตาราง จึงเก็บแยกเพื่อยิง setSharesBulk คนละ kind
  const [selectedRecurringIds, setSelectedRecurringIds] = useState<string[]>([]);

  const toggleSelect = (id: string) =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  const toggleSelectRecurring = (id: string) =>
    setSelectedRecurringIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const toggleGroup = (id: string) =>
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleOwner = (id: string) =>
    setOpenOwners(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleCard = (id: string) =>
    setOpenCards(prev => ({ ...prev, [id]: !prev[id] }));

  // โมดัลที่เปิดอยู่ — เก็บเป็นก้อนเดียวเพื่อให้เปิดได้ทีละใบ
  const [modal, setModal] = useState<ModalState>(null);
  const closeModal = () => setModal(null);

  /**
   * ลบรายการ — ยืนยันในแอปแทน window.confirm ของเบราว์เซอร์
   *
   * ลบแล้วกู้คืนไม่ได้ (ไม่มี soft delete ฝั่ง DB) จึงต้องถามก่อนเสมอ
   * แต่ถามด้วย toast ที่หน้าตาเข้ากับแอปและไม่บล็อกทั้งหน้า
   */
  const confirmDelete = (
    label: string,
    action: () => Promise<{ success: boolean; error?: string }>
  ) => {
    toast(`ลบ "${label}" ใช่ไหม?`, {
      description: 'ลบแล้วกู้คืนไม่ได้',
      duration: 8000,
      action: {
        label: 'ลบ',
        onClick: () =>
          startDeleting(async () => {
            const result = await action();
            if (result.success) {
              toast.success('ลบแล้ว');
              router.refresh();
            } else {
              toast.error(result.error || 'ลบไม่สำเร็จ');
            }
          }),
      },
      cancel: { label: 'ยกเลิก', onClick: () => {} },
    });
  };

  /** วันที่ตั้งต้นของฟอร์ม — วันนี้เมื่อดูเดือนปัจจุบัน */
  const defaultDate = defaultDateFor(data.month);

  /**
   * บัตรที่ใกล้ครบชำระที่สุด และยังอยู่ในช่วงเตือนล่วงหน้าของบัตรใบนั้น
   * คิดจากวันจริงเทียบกับ remindBeforeDays ไม่ได้ fix ไว้ที่ใบใดใบหนึ่ง
   */
  const dueSoon = data.cards
    .map(card => ({ card, daysLeft: card.daysUntilDue }))
    .filter(({ card, daysLeft }) => daysLeft <= card.remindBeforeDays)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  // ทุกอย่างในหน้านี้อิงสมาชิก ไม่มีคนเลยจะเป็นหน้าว่างที่ไม่รู้ต้องทำอะไรต่อ
  if (data.members.length === 0) {
    return (
      <div className="bg-[#161618] border border-[#26262A] rounded-xl p-8 text-center">
        <p className="text-gray-200 mb-1">ยังไม่มีสมาชิกในบ้าน</p>
        <p className="text-sm text-gray-500">
          หน้านี้ใช้งานได้เมื่อมีสมาชิกอย่างน้อย 1 คน
          <br />
          ตอนนี้ยังเพิ่มสมาชิกจากในแอปไม่ได้ ต้องเพิ่มในตาราง home_members ก่อน
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-white">การเงิน</h1>
        {/* page.tsx รับ ?month= อยู่แล้ว แต่เดิมไม่มีปุ่มให้กด ต้องพิมพ์ URL เอง */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => router.push(`/finance?month=${shiftMonth(data.month, -1)}`)}
            aria-label="เดือนก่อนหน้า"
            className="w-9 h-9 flex items-center justify-center rounded-md border border-[#3A3A40] bg-[#1F1F22] text-gray-400 hover:text-[#00B900] hover:border-[#00B900]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-300 min-w-[7rem] text-center tabular-nums">
            {formatMonthLabel(data.month)}
          </span>
          <button
            type="button"
            onClick={() => router.push(`/finance?month=${shiftMonth(data.month, 1)}`)}
            aria-label="เดือนถัดไป"
            className="w-9 h-9 flex items-center justify-center rounded-md border border-[#3A3A40] bg-[#1F1F22] text-gray-400 hover:text-[#00B900] hover:border-[#00B900]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ใกล้ครบชำระ — บรรทัดเดียวพอ รายละเอียดอยู่ในหัวบัตรอยู่แล้ว */}
      {dueSoon && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Bell className="w-3.5 h-3.5 text-[#F5A524] shrink-0" />
          <p className="text-xs text-[#F5A524] flex-1 min-w-0 truncate">
            {dueSoon.card.name}
            {dueSoon.card.last4 && ` ••••${dueSoon.card.last4}`}{' '}
            {dueSoon.daysLeft === 0
              ? 'ครบชำระวันนี้'
              : `ครบชำระอีก ${dueSoon.daysLeft} วัน`}
          </p>
          <span className="text-xs font-semibold text-[#F5A524] tabular-nums shrink-0">
            {baht(cardTotal(data, dueSoon.card.id))}
          </span>
        </div>
      )}

      {/* กล่อง 1 — ภาพรวม */}
      <OverviewBox
        data={data}
        summaries={summaries}
        onEditIncome={member => setModal({ kind: 'income', member })}
        onFixUnassigned={() => {
          // ติ๊กเฉพาะรายการในบัตรที่ยังไม่ระบุ แล้วกางบล็อกบัตรให้เห็นแถบกำหนด
          const ids = data.expenses
            .filter(e => e.group === 'credit_card' && e.sharedBy.length === 0)
            .map(e => e.id);
          setSelectedIds(ids);
          setOpenOwners(Object.fromEntries(data.members.map(m => [m.id, true])));
          setOpenCards(Object.fromEntries(data.cards.map(c => [c.id, true])));
        }}
      />

      {/* รายการในบัตร */}
      <div className="flex items-center justify-between mb-3 px-1 gap-3">
        <h2 className="text-sm font-medium text-gray-400">รายการในบัตร</h2>
        {data.cards.length > 0 && (
          <button
            type="button"
            onClick={() => setModal({ kind: 'import' })}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-[#3A3A40] bg-[#1F1F22] text-gray-300 hover:text-[#00B900] hover:border-[#00B900]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer"
          >
            <FileUp className="w-3.5 h-3.5" />
            อ่านจากไฟล์
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {/* === บัตรเครดิต — แยก div ตามเจ้าของบัตร === */}
        {data.members.map(owner => {
          const ownedCards = cardsOfOwner(data, owner.id);
          const color = memberColor(data, owner.id);

          return (
            <div
              key={owner.id}
              className="bg-[#161618] border border-l-4 border-[#26262A] rounded-xl"
              style={{ borderLeftColor: color.accent }}
            >
              <GroupHeader
                icon={CreditCard}
                label={`บัตรของ${owner.name}`}
                total={ownerCardTotal(data, owner.id)}
                open={!!openOwners[owner.id]}
                onToggle={() => toggleOwner(owner.id)}
                accentColor={color.accent}
              />

              {openOwners[owner.id] && (
                <div className="px-4 pb-4 flex flex-col gap-4 border-t border-[#26262A] pt-4">
                  {ownedCards.length === 0 && (
                    <p className="text-xs text-gray-600">ยังไม่มีบัตร</p>
                  )}
                  {ownedCards.map(card => {
                const isOpen = !!openCards[card.id];
                const split = cardTotalByMember(data, card.id);
                const items = cardExpenses(data, card.id);
                const installments = cardInstallments(data, card.id);
                const cardLabel = `${card.name}${card.last4 ? ` ••••${card.last4}` : ''}`;

                return (
                  <div
                    key={card.id}
                    // ยกบัตรให้ลอยจากพื้นกลุ่ม ไม่งั้นหลายใบต่อกันจะอ่านเป็นก้อนเดียว
                    className={`bg-[#1C1C1F] border rounded-xl overflow-hidden transition-colors ${
                      isOpen ? 'border-[#3A3A40] shadow-lg shadow-black/20' : 'border-[#2E2E33]'
                    }`}
                  >
                    {/* หัวบัตร — กดเพื่อกาง มีเมนูจัดการมุมขวา */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => toggleCard(card.id)}
                        aria-expanded={isOpen}
                        className="group w-full text-left p-4 hover:bg-[#1F1F22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors cursor-pointer"
                      >
                        {/* เว้นที่ให้ปุ่ม ⋯ ที่ลอยทับมุมขวา (44px + ระยะขอบ) */}
                        <div className="flex items-center justify-between mb-2 pr-14 gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <CreditCard
                              className="w-4 h-4 shrink-0"
                              style={{ color: color.accent }}
                            />
                            <span className="text-sm font-medium text-white truncate">
                              {card.name}
                              {card.last4 && (
                                <span className="text-gray-500"> ••••{card.last4}</span>
                              )}
                            </span>
                          </span>
                          <MemberTag
                            name={memberName(data, card.ownerId)}
                            color={card.ownerId ? memberColor(data, card.ownerId) : undefined}
                          />
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
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[#3A3A40] bg-[#1F1F22] text-gray-300 shrink-0 group-hover:border-[#00B900]/50 group-hover:text-[#00B900] transition-colors">
                            {isOpen ? (
                              <>
                                ซ่อน
                                <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              <>
                                ดูรายการ
                                <ChevronRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </span>
                        </div>
                      </button>

                      {/* เมนูวางทับมุมขวาบน ไม่ซ้อนในปุ่มกาง เพราะปุ่มซ้อนปุ่มไม่ได้ */}
                      <div className="absolute top-2.5 right-2.5">
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
                      <div className="px-4 pb-3 border-t border-[#2E2E33] bg-[#161618]">
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
                                    <CategoryIcon icon={inst.icon || '💳'} className="w-3.5 h-3.5" />
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

                        {/* เลือกหลายรายการพร้อมกัน — เร็วกว่ากดทีละอันตอนนำเข้าใบแจ้งยอด */}
                        {items.length > 0 && (
                          <div className="flex items-center gap-2 pb-2 mb-1 border-b border-[#26262A]">
                            <input
                              type="checkbox"
                              checked={
                                items.length > 0 &&
                                items.every(e => selectedIds.includes(e.id))
                              }
                              onChange={() => {
                                const ids = items.map(e => e.id);
                                const allOn = ids.every(id => selectedIds.includes(id));
                                setSelectedIds(prev =>
                                  allOn
                                    ? prev.filter(id => !ids.includes(id))
                                    : [...new Set([...prev, ...ids])]
                                );
                              }}
                              aria-label={`เลือกทุกรายการใน ${cardLabel}`}
                              className="w-4 h-4 shrink-0 accent-[#00B900] cursor-pointer"
                            />
                            <span className="text-xs text-gray-400">
                              เลือกทั้งหมด {items.length} รายการ
                            </span>
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
                              selectable
                              selected={selectedIds.includes(e.id)}
                              onToggleSelect={() => toggleSelect(e.id)}
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
                            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-[#00B900] border border-[#3A3A40] bg-[#1F1F22] hover:border-[#00B900]/50 rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B900]/60 transition-colors mr-auto cursor-pointer"
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
                    <AddButton
                      label={`เพิ่มบัตรให้${owner.name}`}
                      onClick={() => setModal({ kind: 'card', defaultOwnerId: owner.id })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

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
              {data.expenses.filter(e => e.group === 'cash').length === 0 && (
                <p className="text-xs text-gray-600 py-2">
                  ยังไม่มีรายการเงินสด — เช่น ค่าน้ำ ค่าไฟ ของใช้เข้าบ้าน
                </p>
              )}
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
                      selectable
                      selected={selectedIds.includes(e.id)}
                      onToggleSelect={() => toggleSelect(e.id)}
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
              <div className="pb-2 mb-1 border-b border-[#26262A]">
                <SplitLine data={data} totals={groupTotalByMember(data, 'recurring')} />
              </div>
              {data.expenses.filter(e => e.group === 'recurring').length === 0 && (
                <p className="text-xs text-gray-600 py-2">
                  ยังไม่มีรายจ่ายประจำ — เช่น Netflix ค่าเน็ต ค่าส่วนกลาง
                </p>
              )}
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
                      selectable
                      selected={selectedRecurringIds.includes(e.id)}
                      onToggleSelect={() => toggleSelectRecurring(e.id)}
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

      <BulkAssignBar
        members={data.members}
        selectedIds={selectedIds}
        recurringIds={selectedRecurringIds}
        onClear={() => {
          setSelectedIds([]);
          setSelectedRecurringIds([]);
        }}
      />

      {/* โมดัลทั้งหมด — เปิดได้ทีละใบตามสถานะเดียว */}
      {modal?.kind === 'income' && (
        <IncomeModal member={modal.member} period={data.month} onClose={closeModal} />
      )}

      {modal?.kind === 'card' && (
        <CardModal
          members={data.members}
          card={modal.card}
          defaultOwnerId={modal.defaultOwnerId}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'expense' && (
        <ExpenseModal
          members={data.members}
          channel={modal.channel}
          cardId={modal.cardId}
          cardLabel={modal.cardLabel}
          cardOwnerId={data.cards.find(c => c.id === modal.cardId)?.ownerId}
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
          members={data.members}
          defaultCardId={modal.cardId}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
