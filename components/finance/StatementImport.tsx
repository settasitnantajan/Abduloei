'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, Loader2, Trash2, X, AlertTriangle, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { createExpensesBulk, findDuplicates } from '@/app/actions/finance';
import { isEncryptedPdfFile } from '@/lib/finance/pdf-encrypted';
import type { CreditCard } from '@/lib/types/finance';

/** รายการที่ AI อ่านได้ 1 รายการ พร้อมสถานะที่ผู้ใช้แก้ได้ */
interface DraftRow {
  /** คีย์ชั่วคราวสำหรับ React */
  key: string;
  title: string;
  amount: number;
  date: string;
  icon: string | null;
  /** ติ๊กไว้ = จะถูกบันทึก */
  selected: boolean;
  /** บัตรที่จะบันทึกเข้า — เปลี่ยนรายตัวได้ */
  cardId: string;
  /** มาจากไฟล์ไหน (ไว้บอกผู้ใช้) */
  fileName: string;
  /**
   * ซ้ำกับอะไร — 'expense' = มีรายการนี้อยู่แล้ว, 'installment' = ยอดตรงกับงวดผ่อน
   * null = ไม่ซ้ำ
   */
  duplicate: 'expense' | 'installment' | null;
}

interface ApiExpense {
  date: string;
  title: string;
  amount: number;
  icon: string | null;
}

interface ApiFileResult {
  fileName: string;
  cardId: string | null;
  expenses: ApiExpense[];
  warning?: string;
  error?: string;
  needPassword?: boolean;
}

/** ไฟล์ที่เลือกไว้ รอส่งไปอ่าน */
interface PendingFile {
  file: File;
  cardId: string;
  /** รหัสปลดล็อกไฟล์ (ธนาคารมักล็อกด้วยวันเกิด/เลขบัตรประชาชน) */
  password: string;
  /** ไฟล์นี้ล็อกรหัส — ตรวจตั้งแต่ตอนเลือกไฟล์ หรือจาก server ตอบกลับ */
  needPassword?: boolean;
  /** รหัสที่ใส่มาผิด (จาก server) — แยกจาก needPassword เพื่อให้ข้อความต่างกัน */
  passwordError?: string;
}

/** รวมรายการสองชุดเข้าด้วยกัน พร้อมแก้ key ไม่ให้ซ้ำ */
function mergeRows(previous: DraftRow[], incoming: DraftRow[]): DraftRow[] {
  const used = new Set(previous.map(r => r.key));
  const fixed = incoming.map(row => {
    let key = row.key;
    while (used.has(key)) key = `${key}-x`;
    used.add(key);
    return key === row.key ? row : { ...row, key };
  });
  return [...previous, ...fixed];
}

function baht(n: number): string {
  return `฿${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** ชื่อบัตรแบบเต็มสำหรับแสดงผล */
function cardLabel(card: CreditCard): string {
  return card.last4 ? `${card.name} ••••${card.last4}` : card.name;
}

/** คีย์จับคู่รายการ ต้องสร้างแบบเดียวกับฝั่ง server (lib/db/finance.ts) */
function dupKey(date: string, amount: number, title: string): string {
  return `${date}|${amount.toFixed(2)}|${title.trim().toLowerCase()}`;
}

interface StatementImportProps {
  cards: CreditCard[];
  /** บัตรตั้งต้น — มีค่าเมื่อกดจากในบัตรใบนั้น */
  defaultCardId?: string;
  onClose: () => void;
}

/**
 * นำเข้ารายการจากใบแจ้งยอดบัตรเครดิต
 *
 * ขั้นตอน: เลือกไฟล์ (หลายไฟล์ได้ แต่ละไฟล์ระบุบัตรเอง) → AI อ่าน → ตรวจ/แก้ → บันทึก
 *
 * ไฟล์ถูกส่งไปอ่านอย่างเดียว ไม่ได้เก็บไว้ที่ไหน และไม่มีอะไรลงฐานข้อมูล
 * จนกว่าผู้ใช้จะกดบันทึก เพราะ AI อ่านตัวเลขผิดได้
 */
export default function StatementImport({
  cards,
  defaultCardId,
  onClose,
}: StatementImportProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<PendingFile[]>([]);
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  // รายการจากไฟล์ที่อ่านสำเร็จแล้ว พักไว้ระหว่างรอผู้ใช้ใส่รหัสของไฟล์ที่เหลือ
  const [readyRows, setReadyRows] = useState<DraftRow[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const fallbackCardId = defaultCardId || cards[0]?.id || '';

  const handlePickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    setError(null);
    // เคลียร์ค่าทันทีเพื่อให้เลือกไฟล์เดิมซ้ำได้ (ต้องทำก่อน await)
    e.target.value = '';

    // ตรวจตั้งแต่ตอนนี้ว่าไฟล์ไหนล็อกรหัส จะได้ขึ้นช่องให้ใส่เลย
    // ไม่ต้องให้ผู้ใช้กดอ่านแล้วล้มเหลวก่อนหนึ่งรอบ
    const entries = await Promise.all(
      picked.map(async file => ({
        file,
        cardId: fallbackCardId,
        password: '',
        needPassword: await isEncryptedPdfFile(file),
      }))
    );
    setPending(prev => [...prev, ...entries]);
  };

  const removePending = (index: number) => {
    setPending(prev => prev.filter((_, i) => i !== index));
  };

  const setPendingCard = (index: number, cardId: string) => {
    setPending(prev => prev.map((p, i) => (i === index ? { ...p, cardId } : p)));
  };

  const setPendingPassword = (index: number, password: string) => {
    // พิมพ์ใหม่ = ล้างข้อความ "รหัสไม่ถูกต้อง" ของรอบก่อน
    setPending(prev =>
      prev.map((p, i) => (i === index ? { ...p, password, passwordError: undefined } : p))
    );
  };

  /** ส่งไฟล์ทั้งหมดไปให้ AI อ่าน */
  const handleRead = async () => {
    if (pending.length === 0) {
      setError('กรุณาเลือกไฟล์ก่อน');
      return;
    }
    if (pending.some(p => !p.cardId)) {
      setError('กรุณาเลือกบัตรให้ครบทุกไฟล์');
      return;
    }

    setIsReading(true);
    setError(null);
    try {
      const formData = new FormData();
      for (const p of pending) {
        formData.append('files', p.file);
        formData.append('cardIds', p.cardId);
        formData.append('passwords', p.password);
      }

      const res = await fetch('/api/finance/parse-statement', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'อ่านไฟล์ไม่สำเร็จ');
        return;
      }

      const draft: DraftRow[] = [];
      const messages: string[] = [];

      // ไฟล์ที่ยังเปิดไม่ได้เพราะรหัส — เก็บข้อความไว้บอกรายไฟล์
      const lockedMessages = new Map<string, string>();
      for (const r of data.results as ApiFileResult[]) {
        if (r.needPassword) lockedMessages.set(r.fileName, r.error || 'ไฟล์นี้ล็อกรหัส');
      }
      if (lockedMessages.size > 0) {
        setPending(prev =>
          prev.map(p =>
            lockedMessages.has(p.file.name)
              ? {
                  ...p,
                  needPassword: true,
                  // ใส่รหัสมาแล้วยังไม่ผ่าน = รหัสผิด ต้องบอกให้ต่างจาก "ยังไม่ได้ใส่"
                  passwordError: p.password ? lockedMessages.get(p.file.name) : undefined,
                }
              : p
          )
        );
      }

      for (const result of data.results as ApiFileResult[]) {
        if (result.error) {
          messages.push(`${result.fileName}: ${result.error}`);
          continue;
        }
        if (result.warning) messages.push(`${result.fileName}: ${result.warning}`);

        const cardId = result.cardId || fallbackCardId;
        for (const item of result.expenses) {
          draft.push({
            key: `${result.fileName}-${draft.length}`,
            title: item.title,
            amount: item.amount,
            date: item.date,
            icon: item.icon,
            selected: true,
            cardId,
            fileName: result.fileName,
            duplicate: null,
          });
        }
      }

      // ตรวจซ้ำที่ฝั่ง server — เทียบข้ามเดือนและเทียบกับงวดผ่อนได้
      // (ฝั่ง client เห็นแค่รายการของเดือนที่เปิดอยู่ จึงตรวจไม่ครบ)
      const byCard = new Map<string, typeof draft>();
      for (const row of draft) {
        const list = byCard.get(row.cardId) ?? [];
        list.push(row);
        byCard.set(row.cardId, list);
      }

      for (const [cardId, rows] of byCard) {
        try {
          const report = await findDuplicates(
            cardId,
            rows.map(r => ({ date: r.date, title: r.title, amount: r.amount }))
          );
          for (const row of rows) {
            const kind = report[dupKey(row.date, row.amount, row.title)];
            if (kind) {
              row.duplicate = kind;
              // รายการที่ซ้ำไม่ติ๊กให้ ผู้ใช้ติ๊กเองได้ถ้าตั้งใจ
              row.selected = false;
            }
          }
        } catch {
          // ตรวจซ้ำไม่ได้ก็ให้นำเข้าต่อได้ แค่ไม่มีคำเตือน
          console.error('[StatementImport] ตรวจรายการซ้ำไม่สำเร็จ');
        }
      }

      // ยังมีไฟล์ที่เปิดไม่ได้ — อยู่หน้าเลือกไฟล์ให้ใส่รหัสก่อน
      // (เดิมเช็ก draft.length === 0 ด้วย ทำให้กรณีไฟล์ผสมข้ามไปหน้าตรวจ
      //  แล้วช่องรหัสของไฟล์ที่ล็อกไม่มีทางโผล่)
      if (lockedMessages.size > 0) {
        // รายการที่อ่านได้แล้วเก็บไว้ รอรวมกับรอบถัดไป ไม่ต้องอ่านซ้ำ
        setReadyRows(prev => mergeRows(prev, draft));
        // ไฟล์ที่อ่านสำเร็จแล้วเอาออกจากคิว จะได้ไม่ส่งซ้ำตอนกดอ่านอีกรอบ
        setPending(prev => prev.filter(p => lockedMessages.has(p.file.name)));
        setNotices(messages.filter(m => !/ล็อกรหัส|รหัสผ่าน/.test(m)));
        setError(
          draft.length > 0
            ? `อ่านได้แล้ว ${draft.length} รายการ — ใส่รหัสของไฟล์ที่เหลือแล้วกดอ่านอีกครั้ง`
            : 'กรุณาใส่รหัสผ่านของไฟล์ที่ล็อกไว้ แล้วกดอ่านไฟล์อีกครั้ง'
        );
        return;
      }

      const combined = mergeRows(readyRows, draft);
      setNotices(messages);
      setRows(combined);
      setReadyRows([]);

      if (combined.length === 0 && messages.length === 0) {
        setError('ไม่พบรายการใช้จ่ายในไฟล์ที่เลือก');
      }
    } catch {
      setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsReading(false);
    }
  };

  const updateRow = (key: string, patch: Partial<DraftRow>) => {
    setRows(prev => (prev ? prev.map(r => (r.key === key ? { ...r, ...patch } : r)) : prev));
  };

  const removeRow = (key: string) => {
    setRows(prev => (prev ? prev.filter(r => r.key !== key) : prev));
  };

  const selected = rows?.filter(r => r.selected) ?? [];
  const selectedTotal = selected.reduce((sum, r) => sum + r.amount, 0);
  const dupExpenseCount = rows?.filter(r => r.duplicate === 'expense').length ?? 0;
  const dupInstallmentCount = rows?.filter(r => r.duplicate === 'installment').length ?? 0;

  // ยังมีไฟล์ที่ล็อกแต่ยังไม่ได้พิมพ์รหัส — กดอ่านไปก็ล้มเหลวแน่นอน
  const missingPassword = pending.some(p => p.needPassword && !p.password.trim());

  const toggleAll = (value: boolean) => {
    setRows(prev => (prev ? prev.map(r => ({ ...r, selected: value })) : prev));
  };

  /** บันทึกรายการที่ติ๊กไว้ แยกตามบัตรที่แต่ละแถวเลือก */
  const handleSave = () => {
    if (selected.length === 0) {
      setError('กรุณาเลือกอย่างน้อย 1 รายการ');
      return;
    }

    setError(null);
    startSaving(async () => {
      // จัดกลุ่มตามบัตร เพราะ action รับทีละบัตร
      const byCard = new Map<string, typeof selected>();
      for (const row of selected) {
        const list = byCard.get(row.cardId) ?? [];
        list.push(row);
        byCard.set(row.cardId, list);
      }

      let saved = 0;
      const failures: string[] = [];

      for (const [cardId, items] of byCard) {
        const result = await createExpensesBulk(
          cardId,
          items.map(i => ({
            title: i.title,
            amount: i.amount,
            spentOn: i.date,
            icon: i.icon,
          }))
        );
        if (result.success) {
          saved += result.inserted ?? items.length;
        } else {
          const card = cards.find(c => c.id === cardId);
          failures.push(`${card ? cardLabel(card) : 'บัตร'}: ${result.error}`);
        }
      }

      if (saved > 0) {
        toast.success(`บันทึก ${saved} รายการแล้ว`);
        router.refresh();
      }
      if (failures.length > 0) {
        setError(failures.join(' · '));
        return;
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-[#1A1A1A] border border-[#333338] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A2A] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00B900]/20 flex items-center justify-center text-[#00B900]">
              <FileUp className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-white">อ่านรายการจากใบแจ้งยอด</h2>
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ---- ขั้นที่ 1: เลือกไฟล์ ---- */}
          {!rows && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={handlePickFiles}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 rounded-xl border border-dashed border-[#333338] hover:border-[#00B900]/50 text-gray-400 hover:text-[#00B900] transition-colors flex flex-col items-center gap-2"
              >
                <FileUp className="w-6 h-6" />
                <span className="text-sm">เลือกไฟล์ใบแจ้งยอด (PDF หรือรูปภาพ)</span>
                <span className="text-xs text-gray-600">เลือกได้หลายไฟล์พร้อมกัน</span>
              </button>

              {pending.length > 0 && (
                <div className="space-y-2">
                  {pending.map((p, i) => (
                    <div
                      key={`${p.file.name}-${i}`}
                      className="bg-[#111111] border border-[#26262A] rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{p.file.name}</p>
                        <p className="text-xs text-gray-600">
                          {(p.file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <select
                        value={p.cardId}
                        onChange={e => setPendingCard(i, e.target.value)}
                        className="h-9 px-2 rounded-lg border border-[#333338] bg-[#1A1A1A] text-white text-xs focus:outline-none focus:border-[#00B900]/60"
                      >
                        {cards.map(c => (
                          <option key={c.id} value={c.id}>
                            {cardLabel(c)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removePending(i)}
                        aria-label="เอาไฟล์นี้ออก"
                        className="p-1.5 rounded-lg text-gray-500 hover:text-[#F0384E] hover:bg-[#F0384E]/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      </div>

                      {/* ไฟล์ล็อกรหัส — ธนาคารมักล็อกด้วยวันเกิดหรือเลขบัตรประชาชน */}
                      {p.needPassword && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <Lock
                              className={`w-3.5 h-3.5 shrink-0 ${
                                p.passwordError ? 'text-[#F0384E]' : 'text-[#F5A524]'
                              }`}
                            />
                            <input
                              type="password"
                              value={p.password}
                              onChange={e => setPendingPassword(i, e.target.value)}
                              placeholder="ใส่รหัสผ่านของไฟล์นี้"
                              aria-label={`รหัสผ่านของ ${p.file.name}`}
                              aria-invalid={!!p.passwordError}
                              className={`flex-1 h-9 px-2 rounded-lg border bg-[#1A1A1A] text-white text-xs placeholder:text-gray-600 focus:outline-none ${
                                p.passwordError
                                  ? 'border-[#F0384E]/60 focus:border-[#F0384E]'
                                  : 'border-[#F5A524]/40 focus:border-[#F5A524]'
                              }`}
                            />
                          </div>
                          <p
                            className={`mt-1 ml-5 text-[0.65rem] ${
                              p.passwordError ? 'text-[#F0384E]' : 'text-gray-500'
                            }`}
                          >
                            {p.passwordError ?? 'ไฟล์นี้ล็อกรหัสไว้ มักเป็นวันเกิดหรือเลขบัตรประชาชน'}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-600">
                ไฟล์จะถูกอ่านเพื่อดึงรายการเท่านั้น ไม่มีการบันทึกไฟล์ไว้ในระบบ
                และรายการจะยังไม่เข้าบัตรจนกว่าคุณจะตรวจและกดบันทึก
              </p>
            </>
          )}

          {/* ---- ขั้นที่ 2: ตรวจรายการ ---- */}
          {rows && (
            <>
              {notices.length > 0 && (
                <div className="px-3 py-2 rounded-lg bg-[#F5A524]/10 border border-[#F5A524]/30 text-xs text-[#F5A524] space-y-1">
                  {notices.map((n, i) => (
                    <p key={i}>{n}</p>
                  ))}
                </div>
              )}

              {dupExpenseCount > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#F5A524]/10 border border-[#F5A524]/30 text-xs text-[#F5A524]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    พบ {dupExpenseCount} รายการที่มีอยู่แล้วในระบบ — ไม่ได้ติ๊กไว้ให้
                  </span>
                </div>
              )}

              {dupInstallmentCount > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#F5A524]/10 border border-[#F5A524]/30 text-xs text-[#F5A524]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    พบ {dupInstallmentCount} รายการที่ยอดตรงกับงวดผ่อนที่บันทึกไว้ —
                    ถ้านำเข้าด้วยยอดจะถูกนับซ้ำสองชั้น
                  </span>
                </div>
              )}

              {rows.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => toggleAll(true)}
                      className="text-gray-400 hover:text-[#00B900] transition-colors"
                    >
                      เลือกทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAll(false)}
                      className="text-gray-400 hover:text-[#00B900] transition-colors"
                    >
                      ไม่เลือกเลย
                    </button>
                  </div>
                  <span className="text-gray-400 tabular-nums">
                    เลือก {selected.length}/{rows.length} · รวม{' '}
                    <span className="text-white font-semibold">{baht(selectedTotal)}</span>
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {rows.map(row => (
                  <div
                    key={row.key}
                    className={`rounded-lg border p-3 transition-colors ${
                      row.selected
                        ? 'bg-[#111111] border-[#26262A]'
                        : 'bg-[#0D0D0D] border-[#1F1F22] opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={e => updateRow(row.key, { selected: e.target.checked })}
                        aria-label={`เลือก ${row.title}`}
                        className="w-4 h-4 mt-2 accent-[#00B900] shrink-0"
                      />

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={row.icon ?? ''}
                            onChange={e => updateRow(row.key, { icon: e.target.value || null })}
                            maxLength={4}
                            aria-label="ไอคอน"
                            className="w-12 h-9 px-2 text-center rounded-lg border border-[#333338] bg-[#1A1A1A] text-white text-sm focus:outline-none focus:border-[#00B900]/60"
                          />
                          <input
                            type="text"
                            value={row.title}
                            onChange={e => updateRow(row.key, { title: e.target.value })}
                            aria-label="ชื่อรายการ"
                            className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-[#333338] bg-[#1A1A1A] text-white text-sm focus:outline-none focus:border-[#00B900]/60"
                          />
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={e => updateRow(row.key, { date: e.target.value })}
                            aria-label="วันที่"
                            className="h-9 px-2 rounded-lg border border-[#333338] bg-[#1A1A1A] text-white text-xs focus:outline-none focus:border-[#00B900]/60 [color-scheme:dark]"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.amount}
                            onChange={e =>
                              updateRow(row.key, { amount: Number(e.target.value) || 0 })
                            }
                            aria-label="จำนวนเงิน"
                            className="w-28 h-9 px-2 rounded-lg border border-[#333338] bg-[#1A1A1A] text-white text-sm tabular-nums focus:outline-none focus:border-[#00B900]/60"
                          />
                          <select
                            value={row.cardId}
                            onChange={e => updateRow(row.key, { cardId: e.target.value })}
                            aria-label="บัตร"
                            className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-[#333338] bg-[#1A1A1A] text-white text-xs focus:outline-none focus:border-[#00B900]/60"
                          >
                            {cards.map(c => (
                              <option key={c.id} value={c.id}>
                                {cardLabel(c)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {row.duplicate && (
                          <p className="text-[0.65rem] text-[#F5A524]">
                            {row.duplicate === 'installment'
                              ? 'ยอดตรงกับงวดผ่อนที่บันทึกไว้ — อาจนับซ้ำ'
                              : 'มีรายการนี้อยู่แล้วในระบบ'}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        aria-label={`เอา ${row.title} ออก`}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-[#F0384E] hover:bg-[#F0384E]/10 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* ---- ปุ่มล่าง ---- */}
        <div className="flex gap-3 p-5 border-t border-[#2A2A2A] shrink-0">
          <button
            type="button"
            onClick={rows ? () => setRows(null) : onClose}
            disabled={isReading || isSaving}
            className="flex-1 h-10 rounded-lg border border-[#333338] text-gray-300 text-sm font-medium hover:bg-[#2A2A2A] disabled:opacity-50 transition-colors"
          >
            {rows ? 'ย้อนกลับ' : 'ยกเลิก'}
          </button>

          {rows ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || selected.length === 0}
              className="flex-1 h-10 rounded-lg bg-[#00B900] hover:bg-[#00A000] disabled:bg-[#00B900]/40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึก...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> บันทึก {selected.length} รายการ
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRead}
              disabled={isReading || pending.length === 0 || missingPassword}
              className="flex-1 h-10 rounded-lg bg-[#00B900] hover:bg-[#00A000] disabled:bg-[#00B900]/40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isReading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> กำลังอ่าน...
                </>
              ) : missingPassword ? (
                'ใส่รหัสก่อน'
              ) : (
                'อ่านไฟล์'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
