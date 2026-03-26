import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LineLinkingCard from '@/components/settings/LineLinkingCard';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">ตั้งค่า</h1>
          <p className="text-gray-400 text-sm">ตั้งค่าแอปพลิเคชัน</p>
        </div>

        <div className="space-y-4">
          <LineLinkingCard />
        </div>
      </div>
    </div>
  );
}
