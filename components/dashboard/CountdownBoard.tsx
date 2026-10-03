'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Bell, CheckCircle2 } from 'lucide-react';
import {
  breakdown,
  isSoon,
  formatRelativeThai,
  formatThaiFullDate,
  KIND_META,
  type CountdownItem,
} from '@/lib/utils/countdown';

interface CountdownBoardProps {
  items: CountdownItem[];
}

/** ตัวเลข 2 หลักเติมศูนย์หน้า */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * นาฬิกากลางของหน้า — เดินทุก 1 วินาที
 * ใช้ตัวเดียวคุมทุกการ์ด แทนที่จะให้แต่ละใบตั้ง interval ของตัวเอง
 */
function useNow(): number | null {
  // เริ่มเป็น null เพื่อให้ HTML ฝั่ง server กับ client ตรงกัน (กัน hydration mismatch)
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // ตั้งค่าแรกใน timeout ไม่ใช่ใน effect body ตรง ๆ — เลี่ยง cascading render
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  return now;
}

/** เว้นระยะอย่างน้อยเท่านี้ก่อนยิง refresh รอบถัดไป กัน server โดนถล่ม */
const REFRESH_COOLDOWN_MS = 10_000;
/** ยิง refresh กันเหนียวทุก 5 นาที เผื่อมีข้อมูลเพิ่มจากที่อื่น (เช่น สั่งผ่าน LINE) */
const HEARTBEAT_MS = 5 * 60 * 1000;

/**
 * ดึงข้อมูลใหม่จาก server เพื่อให้รอบถัดไปของกิจวัตรเป็นปัจจุบันเสมอ
 *
 * การคำนวณรอบถัดไปอยู่ฝั่ง server (app/dashboard/page.tsx) ตัวนี้จึงไม่คำนวณเอง
 * แค่บอก Next.js ให้ไป render ใหม่ — ข้อมูลอัปเดตโดยหน้าไม่กระพริบและไม่เสีย scroll
 */
function useServerRefresh(nextTargetMs: number | null) {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  // ขอ refresh โดยเคารพ cooldown — useCallback ให้ค่า router ใหม่เสมอ
  const request = useCallback(() => {
    const t = Date.now();
    if (t - lastRefreshRef.current < REFRESH_COOLDOWN_MS) return;
    lastRefreshRef.current = t;
    router.refresh();
  }, [router]);

  // 1) รายการใกล้ที่สุดถึงเวลา → ขอรอบใหม่ทันที
  //    หน่วง 1 วิ ให้ server พ้นเส้นเวลาไปแล้วจริง ๆ ไม่งั้นอาจได้รอบเดิมกลับมา
  //    ผูกกับ nextTargetMs อย่างเดียว ไม่ผูกกับนาฬิกาที่เดินทุกวินาที
  //    ไม่งั้น timeout จะถูกล้างแล้วตั้งใหม่ 60 ครั้งต่อนาทีโดยเปล่าประโยชน์
  useEffect(() => {
    if (nextTargetMs === null) return;
    const delay = nextTargetMs - Date.now() + 1000;
    if (delay <= 0) {
      request();
      return;
    }
    // setTimeout เก็บได้สูงสุด ~24.8 วัน ถ้าไกลกว่านั้นปล่อยให้ heartbeat จัดการ
    if (delay > 2_147_483_647) return;
    const id = setTimeout(() => request(), delay);
    return () => clearTimeout(id);
  }, [nextTargetMs, request]);

  // 2) กลับมาที่แท็บ / เครื่องตื่นจาก sleep → ข้อมูลอาจค้างนาน ดึงใหม่
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [request]);

  // 3) กันเหนียว — เผื่อมีรายการใหม่เข้ามาจากช่องทางอื่นระหว่างเปิดหน้าค้างไว้
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') request();
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [request]);
}

/** ตัวเลขนับถอยหลังแบบเต็ม ใช้ในการ์ดใหญ่ */
function HeroCountdown({ targetMs, nowMs }: { targetMs: number; nowMs: number }) {
  const t = breakdown(targetMs, nowMs);
  const units: [string, number][] = [
    ['วัน', t.days],
    ['ชม.', t.hours],
    ['นาที', t.minutes],
    ['วิ', t.seconds],
  ];

  return (
    <div className="flex items-start justify-center gap-2 sm:gap-4 py-2">
      {units.map(([label, value], i) => (
        <div key={label} className="flex items-start gap-2 sm:gap-4">
          <div className="flex flex-col items-center gap-1.5 min-w-[3.25rem] sm:min-w-[4.5rem]">
            <span className="text-4xl sm:text-6xl font-bold text-white tabular-nums leading-none tracking-tight">
              {pad(value)}
            </span>
            <span className="text-[0.65rem] sm:text-xs text-gray-500">{label}</span>
          </div>
          {i < units.length - 1 && (
            <span className="text-3xl sm:text-5xl font-light text-[#333333] leading-none mt-0.5">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** ตัวเลขนับถอยหลังแบบบรรทัดเดียว ใช้ในลิสต์ */
function InlineCountdown({
  targetMs,
  nowMs,
  soon,
}: {
  targetMs: number;
  nowMs: number;
  soon: boolean;
}) {
  const t = breakdown(targetMs, nowMs);
  return (
    <span
      className={`text-sm sm:text-base font-semibold tabular-nums ${
        soon ? 'text-[#F5A524]' : 'text-gray-300'
      }`}
    >
      {pad(t.days)}:{pad(t.hours)}:{pad(t.minutes)}:{pad(t.seconds)}
    </span>
  );
}

/** แถวรายการในลิสต์ */
function ItemRow({
  item,
  nowMs,
  soon,
}: {
  item: CountdownItem;
  nowMs: number;
  soon: boolean;
}) {
  const meta = KIND_META[item.kind];

  return (
    <Link
      href={meta.href}
      className="flex items-stretch gap-3 p-3 sm:p-4 hover:bg-[#1F1F22] transition-colors"
    >
      {/* แถบสีบอกความเร่งด่วน */}
      <span
        aria-hidden="true"
        className={`w-1 rounded-full shrink-0 ${soon ? 'bg-[#F5A524]' : 'bg-[#333333]'}`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm sm:text-base font-medium text-white truncate">{item.title}</p>
          <span
            className={`text-[0.65rem] px-1.5 py-0.5 rounded shrink-0 border ${meta.bg} ${meta.text} ${meta.border}`}
          >
            {meta.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate">{item.scheduleLabel}</p>
      </div>

      <div className="flex items-center shrink-0">
        <InlineCountdown targetMs={item.targetMs} nowMs={nowMs} soon={soon} />
      </div>
    </Link>
  );
}

/** กล่องลิสต์พร้อมหัวข้อกลุ่ม */
function ItemGroup({
  title,
  items,
  nowMs,
  soon,
}: {
  title: string;
  items: CountdownItem[];
  nowMs: number;
  soon: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-5">
      <h3 className="text-xs text-gray-500 mb-2 px-1">{title}</h3>
      <div className="bg-[#161618] border border-[#26262A] rounded-xl overflow-hidden divide-y divide-[#26262A]">
        {items.map(item => (
          <ItemRow key={`${item.kind}-${item.id}`} item={item} nowMs={nowMs} soon={soon} />
        ))}
      </div>
    </section>
  );
}

export default function CountdownBoard({ items }: CountdownBoardProps) {
  const now = useNow();

  // เรียงตามเวลาที่ใกล้ถึงที่สุด — ทำครั้งเดียวจนกว่า items จะเปลี่ยน
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.targetMs - b.targetMs),
    [items]
  );

  // เวลาของรายการที่จะถึงก่อนใคร ใช้เป็นสัญญาณว่าควรดึงข้อมูลใหม่เมื่อไร
  // คิดจากชุดข้อมูลที่ server ส่งมา ไม่ผูกกับนาฬิกาที่เดินทุกวินาที
  // ค่าจึงคงที่จนกว่าจะได้ข้อมูลรอบใหม่ — timeout ด้านล่างไม่ถูกตั้งใหม่ซ้ำ ๆ
  const nextTargetMs = useMemo(() => sorted[0]?.targetMs ?? null, [sorted]);

  // ต้องเรียกก่อน early return ทุกกรณี — กฎของ React hooks
  useServerRefresh(nextTargetMs);

  // ก่อน mount ยังไม่รู้เวลาจริง แสดงโครงไว้ก่อนกัน layout กระโดด
  if (now === null) {
    return <div className="h-64 bg-[#161618] border border-[#26262A] rounded-2xl animate-pulse" />;
  }

  // ตัดรายการที่เลยเวลาไปแล้วออก (ตามที่ตกลง: ซ่อนของเลยกำหนด)
  const upcoming = sorted.filter(item => item.targetMs > now);

  if (upcoming.length === 0) {
    return (
      <div className="bg-[#161618] border border-[#26262A] rounded-2xl p-10 text-center">
        <CheckCircle2 className="w-10 h-10 text-[#00B900] mx-auto mb-4" strokeWidth={1.5} />
        <p className="text-white font-medium mb-1">ไม่มีรายการที่กำลังจะถึง</p>
        <p className="text-sm text-gray-500 mb-5">เพิ่มนัดหมายหรืองานได้จากหน้าแชท</p>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00B900] text-black text-sm font-medium hover:bg-[#00A000] transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          ไปที่แชท
        </Link>
      </div>
    );
  }

  const [hero, ...rest] = upcoming;
  const heroMeta = KIND_META[hero.kind];
  const soonItems = rest.filter(i => isSoon(i.targetMs, now));
  const laterItems = rest.filter(i => !isSoon(i.targetMs, now));

  return (
    <div>
      {/* หัวเรื่อง + วันที่วันนี้ */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">ภาพรวม</h1>
        <p className="text-gray-400 text-sm tabular-nums">{formatThaiFullDate(now)}</p>
      </header>

      {/* การ์ดใหญ่ — รายการที่ใกล้ถึงที่สุด */}
      <Link
        href={heroMeta.href}
        className="block bg-[#161618] border border-[#00B900]/40 rounded-2xl p-5 sm:p-7 mb-8 hover:border-[#00B900]/70 transition-colors"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00B900]" />
            ถัดไป
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded border ${heroMeta.bg} ${heroMeta.text} ${heroMeta.border}`}
          >
            {heroMeta.label}
          </span>
        </div>

        <h2 className="text-lg sm:text-xl font-semibold text-white mb-1 text-balance">
          {hero.title}
        </h2>
        {hero.description && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">{hero.description}</p>
        )}

        <HeroCountdown targetMs={hero.targetMs} nowMs={now} />

        <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-[#26262A]">
          <span className="text-sm text-gray-400">
            {formatRelativeThai(hero.targetMs, now)}
          </span>
          {hero.remindBeforeMinutes ? (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Bell className="w-3.5 h-3.5" />
              เตือนก่อน {hero.remindBeforeMinutes} นาที
            </span>
          ) : null}
        </div>
      </Link>

      {/* ลิสต์ที่เหลือ */}
      {rest.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-gray-400 mb-3 px-1">กำลังจะถึง</h2>
          <ItemGroup title="ใน 24 ชั่วโมง" items={soonItems} nowMs={now} soon />
          <ItemGroup title="ถัดไป" items={laterItems} nowMs={now} soon={false} />
        </>
      )}
    </div>
  );
}
