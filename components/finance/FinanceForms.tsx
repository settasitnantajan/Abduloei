'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Wallet, Home, Receipt, Banknote, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import FinanceModal, {
  DayOfMonthSelect,
  MemberSelect,
  dateInputClass,
  inputClass,
  labelClass,
} from './FinanceModal';
import {
  createCard,
  updateCard,
  createExpense,
  updateExpense,
  createInstallment,
  updateInstallment,
  createRecurring,
  updateRecurring,
  updateMemberIncome,
  convertExpenseToInstallment,
} from '@/app/actions/finance';
import type {
  CreditCard as CreditCardType,
  ExpenseItem,
  FinanceMember,
  Installment,
} from '@/lib/types/finance';

/** ผลลัพธ์มาตรฐานของ action ฝั่งการเงิน */
type Result = { success: boolean; error?: string };

/**
 * ตัวช่วยที่ใช้ร่วมกันทุกฟอร์ม — ส่งข้อมูล แล้วรีเฟรชหน้าเมื่อสำเร็จ
 *
 * ใช้ router.refresh() ตามแพตเทิร์นของแอป (หน้าเป็น force-dynamic อยู่แล้ว)
 * ไม่ได้ใช้ revalidatePath เพราะทั้งโปรเจคไม่ได้ใช้ใน server action
 */
function useSubmit(onDone: () => void) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<Result>, successMessage: string) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(successMessage);
        onDone();
        router.refresh();
      } else {
        setError(result.error || 'เกิดข้อผิดพลาด');
      }
    });
  };

  return { error, setError, isPending, run };
}

/** อ่านตัวเลขจากฟอร์ม ช่องว่างถือเป็น 0 */
function num(data: FormData, key: string): number {
  const raw = (data.get(key) as string | null)?.trim();
  return raw ? Number(raw) : 0;
}

/** อ่านข้อความจากฟอร์ม */
function str(data: FormData, key: string): string {
  return ((data.get(key) as string | null) ?? '').trim();
}

/** ค่าว่างให้เป็น null เพื่อให้ตรงกับคอลัมน์ที่ยอมรับ null */
function orNull(value: string): string | null {
  return value || null;
}

// ---------------------------------------------------------------------------
// รายรับของสมาชิก
// ---------------------------------------------------------------------------

export function IncomeModal({
  member,
  period,
  onClose,
}: {
  member: FinanceMember;
  /** รอบที่กำลังตั้งรายรับให้ YYYY-MM */
  period: string;
  onClose: () => void;
}) {
  const { error, isPending, run } = useSubmit(onClose);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const amount = num(new FormData(e.currentTarget), 'monthlyIncome');
    run(() => updateMemberIncome(member.id, amount, period), 'บันทึกรายรับแล้ว');
  };

  return (
    <FinanceModal
      title={`รายรับของ${member.name}`}
      icon={<Wallet className="w-4 h-4" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isPending={isPending}
      submitLabel="บันทึก"
      pendingLabel="กำลังบันทึก..."
    >
      <div className="space-y-1.5">
        <label className={labelClass}>รายรับของรอบนี้ (บาท)</label>
        <input
          name="monthlyIncome"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          defaultValue={member.monthlyIncome || ''}
          placeholder="เช่น 45000"
          className={inputClass}
          autoFocus
        />
      </div>

      <p className="text-xs text-gray-500">
        ตั้งเฉพาะรอบนี้ — รอบถัดไปจะใช้ค่านี้ต่อจนกว่าจะแก้ใหม่
      </p>
    </FinanceModal>
  );
}

// ---------------------------------------------------------------------------
// บัตรเครดิต
// ---------------------------------------------------------------------------

export function CardModal({
  members,
  card,
  onClose,
}: {
  members: FinanceMember[];
  /** มีค่า = โหมดแก้ไข */
  card?: CreditCardType;
  onClose: () => void;
}) {
  const { error, isPending, run } = useSubmit(onClose);
  const editing = !!card;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      name: str(data, 'name'),
      last4: orNull(str(data, 'last4')),
      ownerMemberId: orNull(str(data, 'memberId')),
      dueDayOfMonth: num(data, 'dayOfMonth'),
      remindBeforeDays: num(data, 'remindBeforeDays'),
    };

    if (editing) {
      run(
        () =>
          updateCard(card.id, {
            name: payload.name,
            last4: payload.last4,
            owner_member_id: payload.ownerMemberId,
            due_day_of_month: payload.dueDayOfMonth,
            remind_before_days: payload.remindBeforeDays,
          }),
        'แก้ไขบัตรแล้ว'
      );
    } else {
      run(() => createCard(payload), 'เพิ่มบัตรแล้ว');
    }
  };

  return (
    <FinanceModal
      title={editing ? 'แก้ไขบัตรเครดิต' : 'เพิ่มบัตรเครดิต'}
      icon={<CreditCard className="w-4 h-4" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isPending={isPending}
      submitLabel={editing ? 'บันทึก' : 'เพิ่มบัตร'}
      pendingLabel="กำลังบันทึก..."
    >
      <div className="space-y-1.5">
        <label className={labelClass}>
          ชื่อบัตร <span className="text-red-400">*</span>
        </label>
        <input
          name="name"
          type="text"
          defaultValue={card?.name}
          placeholder="เช่น KTC, กสิกร"
          className={inputClass}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>เลข 4 ตัวท้าย</label>
          <input
            name="last4"
            type="text"
            inputMode="numeric"
            maxLength={4}
            pattern="\d{4}"
            defaultValue={card?.last4 ?? ''}
            placeholder="4728"
            className={inputClass}
          />
        </div>
        <MemberSelect
          members={members}
          defaultValue={card?.ownerId}
          label="เจ้าของบัตร"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DayOfMonthSelect
          defaultValue={card?.dueDayOfMonth ?? 25}
          label="ครบชำระทุกวันที่"
        />
        <div className="space-y-1.5">
          <label className={labelClass}>เตือนล่วงหน้า</label>
          <select
            name="remindBeforeDays"
            defaultValue={String(card?.remindBeforeDays ?? 3)}
            className={inputClass}
          >
            <option value="0">ไม่เตือนล่วงหน้า</option>
            {[1, 2, 3, 5, 7, 10].map(d => (
              <option key={d} value={d}>
                {d} วัน
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        แจ้งเตือนวันครบชำระจะส่งทาง LINE ให้เจ้าของบัตรเท่านั้น
      </p>
    </FinanceModal>
  );
}

// ---------------------------------------------------------------------------
// รายการใช้จ่าย (บัตร / เงินสด)
// ---------------------------------------------------------------------------

export function ExpenseModal({
  members,
  channel,
  cardId,
  cardLabel,
  expense,
  defaultDate,
  onClose,
}: {
  members: FinanceMember[];
  channel: 'credit_card' | 'cash';
  /** บัตรที่ผูก (เฉพาะ channel = credit_card) */
  cardId?: string;
  cardLabel?: string;
  /** มีค่า = โหมดแก้ไข */
  expense?: ExpenseItem;
  /** วันที่ตั้งต้น — วันที่ 1 ของเดือนที่กำลังดู */
  defaultDate: string;
  onClose: () => void;
}) {
  const { error, isPending, run } = useSubmit(onClose);
  const editing = !!expense;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const common = {
      title: str(data, 'title'),
      amount: num(data, 'amount'),
      paidByMemberId: orNull(str(data, 'memberId')),
      spentOn: str(data, 'spentOn'),
      icon: orNull(str(data, 'icon')),
    };

    if (editing) {
      run(
        () =>
          updateExpense(expense.id, {
            title: common.title,
            amount: common.amount,
            paid_by_member_id: common.paidByMemberId,
            spent_on: common.spentOn,
            icon: common.icon,
          }),
        'แก้ไขรายการแล้ว'
      );
    } else {
      run(
        () => createExpense({ ...common, channel, cardId: cardId ?? null }),
        'เพิ่มรายการแล้ว'
      );
    }
  };

  const isCard = channel === 'credit_card';

  return (
    <FinanceModal
      title={editing ? 'แก้ไขรายการ' : isCard ? `เพิ่มรายการใน ${cardLabel}` : 'เพิ่มรายการเงินสด'}
      icon={isCard ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isPending={isPending}
      submitLabel={editing ? 'บันทึก' : 'เพิ่มรายการ'}
      pendingLabel="กำลังบันทึก..."
    >
      <div className="space-y-1.5">
        <label className={labelClass}>
          ชื่อรายการ <span className="text-red-400">*</span>
        </label>
        <input
          name="title"
          type="text"
          defaultValue={expense?.title}
          placeholder="เช่น น้ำมัน, ซูเปอร์มาร์เก็ต"
          className={inputClass}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>
            จำนวนเงิน <span className="text-red-400">*</span>
          </label>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={expense?.amount ?? ''}
            placeholder="0"
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>ไอคอน</label>
          <input
            name="icon"
            type="text"
            maxLength={4}
            defaultValue={expense?.icon ?? ''}
            placeholder="⛽"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>
            วันที่ <span className="text-red-400">*</span>
          </label>
          <input
            name="spentOn"
            type="date"
            defaultValue={expense?.date ?? defaultDate}
            className={dateInputClass}
            required
          />
        </div>
        <MemberSelect members={members} defaultValue={expense?.paidById} label="ใครจ่าย" />
      </div>
    </FinanceModal>
  );
}

// ---------------------------------------------------------------------------
// ผ่อนชำระ
// ---------------------------------------------------------------------------

export function InstallmentModal({
  members,
  cardId,
  cardLabel,
  installment,
  defaultMonth,
  onClose,
}: {
  members: FinanceMember[];
  cardId: string;
  cardLabel: string;
  /** มีค่า = โหมดแก้ไข */
  installment?: Installment;
  /** เดือนที่กำลังดู YYYY-MM */
  defaultMonth: string;
  onClose: () => void;
}) {
  const { error, isPending, run } = useSubmit(onClose);
  const editing = !!installment;
  const [oneTime, setOneTime] = useState(
    editing ? installment.totalInstallments === null : false
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const startMonth = str(data, 'startMonth');
    const total = oneTime ? null : num(data, 'totalInstallments');

    if (editing) {
      run(
        () =>
          updateInstallment(installment.id, {
            title: str(data, 'title'),
            monthly_amount: num(data, 'monthlyAmount'),
            owner_member_id: orNull(str(data, 'memberId')),
            start_month: `${startMonth}-01`,
            total_installments: total,
            icon: orNull(str(data, 'icon')),
          }),
        'แก้ไขรายการผ่อนแล้ว'
      );
    } else {
      run(
        () =>
          createInstallment({
            title: str(data, 'title'),
            monthlyAmount: num(data, 'monthlyAmount'),
            ownerMemberId: orNull(str(data, 'memberId')),
            cardId,
            startMonth,
            totalInstallments: total,
            icon: orNull(str(data, 'icon')),
          }),
        'เพิ่มรายการผ่อนแล้ว'
      );
    }
  };

  return (
    <FinanceModal
      title={editing ? 'แก้ไขรายการผ่อน' : `เพิ่มผ่อนใน ${cardLabel}`}
      icon={<Receipt className="w-4 h-4" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isPending={isPending}
      submitLabel={editing ? 'บันทึก' : 'เพิ่มผ่อน'}
      pendingLabel="กำลังบันทึก..."
    >
      <div className="space-y-1.5">
        <label className={labelClass}>
          ชื่อรายการ <span className="text-red-400">*</span>
        </label>
        <input
          name="title"
          type="text"
          defaultValue={installment?.title}
          placeholder="เช่น ไอโฟน 15 Pro"
          className={inputClass}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>
            ยอดต่อเดือน <span className="text-red-400">*</span>
          </label>
          <input
            name="monthlyAmount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={installment?.monthlyAmount ?? ''}
            placeholder="0"
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>ไอคอน</label>
          <input
            name="icon"
            type="text"
            maxLength={4}
            defaultValue={installment?.icon ?? ''}
            placeholder="📱"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>
            เริ่มผ่อนเดือน <span className="text-red-400">*</span>
          </label>
          <input
            name="startMonth"
            type="month"
            defaultValue={installment?.startMonth.slice(0, 7) ?? defaultMonth}
            className={dateInputClass}
            required
          />
        </div>
        <MemberSelect members={members} defaultValue={installment?.ownerId} label="ของใคร" />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={oneTime}
          onChange={e => setOneTime(e.target.checked)}
          className="w-4 h-4 accent-[#00B900]"
        />
        จ่ายครั้งเดียว ไม่มีงวด
      </label>

      {!oneTime && (
        <div className="space-y-1.5">
          <label className={labelClass}>
            จำนวนงวดทั้งหมด <span className="text-red-400">*</span>
          </label>
          <input
            name="totalInstallments"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            defaultValue={installment?.totalInstallments ?? 12}
            className={inputClass}
            required
          />
          <p className="text-xs text-gray-500">
            งวดที่เหลือจะลดลงเองทุกเดือน และรายการจะหายไปเมื่อผ่อนครบ
          </p>
        </div>
      )}
    </FinanceModal>
  );
}

// ---------------------------------------------------------------------------
// ค่าใช้จ่ายประจำ (แม่แบบ)
// ---------------------------------------------------------------------------

export function RecurringModal({
  members,
  expense,
  onClose,
}: {
  members: FinanceMember[];
  /** มีค่า = โหมดแก้ไข */
  expense?: ExpenseItem;
  onClose: () => void;
}) {
  const { error, isPending, run } = useSubmit(onClose);
  const editing = !!expense;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      title: str(data, 'title'),
      amount: num(data, 'amount'),
      paidByMemberId: orNull(str(data, 'memberId')),
      dayOfMonth: num(data, 'dayOfMonth'),
      icon: orNull(str(data, 'icon')),
    };

    if (editing) {
      run(
        () =>
          updateRecurring(expense.id, {
            title: payload.title,
            amount: payload.amount,
            paid_by_member_id: payload.paidByMemberId,
            day_of_month: payload.dayOfMonth,
            icon: payload.icon,
          }),
        'แก้ไขค่าใช้จ่ายประจำแล้ว'
      );
    } else {
      run(() => createRecurring(payload), 'เพิ่มค่าใช้จ่ายประจำแล้ว');
    }
  };

  return (
    <FinanceModal
      title={editing ? 'แก้ไขค่าใช้จ่ายประจำ' : 'เพิ่มค่าใช้จ่ายประจำ'}
      icon={<Home className="w-4 h-4" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isPending={isPending}
      submitLabel={editing ? 'บันทึก' : 'เพิ่มรายการ'}
      pendingLabel="กำลังบันทึก..."
    >
      <div className="space-y-1.5">
        <label className={labelClass}>
          ชื่อรายการ <span className="text-red-400">*</span>
        </label>
        <input
          name="title"
          type="text"
          defaultValue={expense?.title}
          placeholder="เช่น ค่าเช่าบ้าน, ค่าไฟ"
          className={inputClass}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>
            จำนวนเงิน <span className="text-red-400">*</span>
          </label>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={expense?.amount ?? ''}
            placeholder="0"
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>ไอคอน</label>
          <input
            name="icon"
            type="text"
            maxLength={4}
            defaultValue={expense?.icon ?? ''}
            placeholder="🏠"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DayOfMonthSelect defaultValue={expense?.dayOfMonth ?? 1} />
        <MemberSelect members={members} defaultValue={expense?.paidById} label="ใครจ่าย" />
      </div>

      <p className="text-xs text-gray-500">
        รายการนี้จะโผล่ให้อัตโนมัติทุกเดือน ไม่ต้องกรอกซ้ำ
      </p>
    </FinanceModal>
  );
}

// ---------------------------------------------------------------------------
// แปลงรายการใช้จ่ายเป็นรายการผ่อน
// ---------------------------------------------------------------------------

export function ConvertToInstallmentModal({
  expense,
  defaultMonth,
  onClose,
}: {
  expense: ExpenseItem;
  /** เดือนที่กำลังดู ใช้เป็นค่าตั้งต้นของเดือนเริ่มผ่อน */
  defaultMonth: string;
  onClose: () => void;
}) {
  const { error, isPending, run } = useSubmit(onClose);
  const [oneTime, setOneTime] = useState(false);

  // วันที่ของรายการบอกได้ว่างวดนี้เป็นของเดือนไหน ใช้เป็นค่าตั้งต้นดีกว่าเดือนที่เปิดดู
  const monthFromDate = expense.date?.slice(0, 7) || defaultMonth;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    run(
      () =>
        convertExpenseToInstallment(expense.id, {
          startMonth: str(data, 'startMonth'),
          totalInstallments: oneTime ? null : num(data, 'totalInstallments'),
        }),
      'แปลงเป็นรายการผ่อนแล้ว'
    );
  };

  return (
    <FinanceModal
      title="แปลงเป็นรายการผ่อน"
      icon={<Repeat className="w-4 h-4" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isPending={isPending}
      submitLabel="แปลง"
      pendingLabel="กำลังแปลง..."
    >
      <div className="rounded-lg bg-[#111111] border border-[#26262A] p-3">
        <p className="text-sm text-white">
          {expense.icon ? `${expense.icon} ` : ''}
          {expense.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          ยอดนี้จะกลายเป็น <span className="text-gray-300">ยอดต่อเดือน</span> ของรายการผ่อน
        </p>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>
          เริ่มผ่อนเดือน <span className="text-red-400">*</span>
        </label>
        <input
          name="startMonth"
          type="month"
          defaultValue={monthFromDate}
          className={dateInputClass}
          required
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={oneTime}
          onChange={e => setOneTime(e.target.checked)}
          className="w-4 h-4 accent-[#00B900]"
        />
        จ่ายทุกเดือน ไม่มีกำหนดจบ
      </label>

      {!oneTime && (
        <div className="space-y-1.5">
          <label className={labelClass}>
            จำนวนงวดทั้งหมด <span className="text-red-400">*</span>
          </label>
          <input
            name="totalInstallments"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            defaultValue={12}
            className={inputClass}
            required
            autoFocus
          />
        </div>
      )}

      <p className="text-xs text-gray-500">
        รายการเดิมจะถูกย้ายไปเป็นรายการผ่อน และจะโผล่เองทุกเดือนจนครบงวด
      </p>
    </FinanceModal>
  );
}
