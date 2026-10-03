import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getFinanceMonth } from '@/lib/db/finance';
import { currentMonth } from '@/lib/finance/calc';
import FinanceBoard from '@/components/finance/FinanceBoard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'การเงิน | Abduloei',
  description: 'จัดการรายรับรายจ่ายของบ้าน',
};

/** เดือนที่ขอมาต้องเป็น YYYY-MM เท่านั้น กัน query string แปลก ๆ */
function parseMonthParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return value;
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // ไม่ระบุเดือน = เดือนปัจจุบันตามเวลาไทย
  const params = await searchParams;
  const month = parseMonthParam(params?.month) ?? currentMonth();

  const { data, error: loadError } = await getFinanceMonth(month);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {data ? (
          <FinanceBoard data={data} />
        ) : (
          <div className="bg-[#161618] border border-[#26262A] rounded-xl p-8 text-center">
            <p className="text-gray-300">โหลดข้อมูลการเงินไม่สำเร็จ</p>
            <p className="text-sm text-gray-500 mt-1">{loadError || 'กรุณาลองใหม่อีกครั้ง'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
