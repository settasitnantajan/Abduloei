import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getExpiryItems } from '@/lib/db/expiry';
import ExpiryBoard from '@/components/expiry/ExpiryBoard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ของหมดอายุ | Abduloei',
  description: 'เช็กว่าของชิ้นไหนใกล้หมดอายุ',
};

export default async function ExpiryPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { data, error: loadError } = await getExpiryItems();

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {data ? (
          <ExpiryBoard items={data} />
        ) : (
          <div className="bg-[#161618] border border-[#26262A] rounded-xl p-8 text-center">
            <p className="text-gray-300">โหลดรายการไม่สำเร็จ</p>
            <p className="text-sm text-gray-500 mt-1">{loadError || 'กรุณาลองใหม่อีกครั้ง'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
