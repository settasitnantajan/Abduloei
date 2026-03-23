import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { User as UserIcon, Mail, Key, Clock, CalendarDays } from 'lucide-react';
import LogoutButton from '@/components/logout-button';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const userInitials = user.email
    ?.split('@')[0]
    .slice(0, 2)
    .toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">โปรไฟล์</h1>
          <p className="text-gray-400 text-sm">โปรไฟล์และข้อมูลบัญชีของคุณ</p>
        </div>

        {/* Profile Card */}
        <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-6 mb-4">
          <div className="flex items-center gap-5 mb-6">
            <div className="w-16 h-16 rounded-full bg-[#00B900] flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-white">{userInitials}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{user.email}</h2>
              <p className="text-sm text-gray-400">
                ID: {user.id.substring(0, 8)}...
              </p>
            </div>
          </div>

          {/* User Details */}
          <div className="space-y-4 border-t border-[#2A2A2A] pt-5">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-500 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">อีเมล</p>
                <p className="text-sm text-white">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-gray-500 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">รหัสผู้ใช้</p>
                <p className="text-sm text-white font-mono">{user.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarDays className="w-4 h-4 text-gray-500 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">สร้างเมื่อ</p>
                <p className="text-sm text-white">
                  {new Date(user.created_at || '').toLocaleDateString('th-TH', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-500 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">เข้าสู่ระบบล่าสุด</p>
                <p className="text-sm text-white">
                  {new Date(user.last_sign_in_at || '').toLocaleDateString('th-TH', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">จัดการบัญชี</h3>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
