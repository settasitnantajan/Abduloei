import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Settings as SettingsIcon } from 'lucide-react';

export default async function SettingsPage() {
  // Check authentication
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">ตั้งค่า</h1>
          <p className="text-gray-400">ตั้งค่าแอปพลิเคชัน</p>
        </div>

        {/* Coming Soon */}
        <div className="bg-[#1A1A1A] border border-[#333333] rounded-lg p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gray-500/10 flex items-center justify-center">
              <SettingsIcon className="w-10 h-10 text-gray-500" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            เร็วๆ นี้
          </h2>
          <p className="text-gray-400 max-w-md mx-auto">
            ฟีเจอร์การตั้งค่ากำลังพัฒนา
          </p>
        </div>
      </div>
    </div>
  );
}
