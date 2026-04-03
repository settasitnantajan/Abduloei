'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Home as HomeIcon, Users, ChevronDown, User } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { getHomeMembers } from '@/app/actions/home-members';

export default function MobileHeader() {
  const router = useRouter();
  const [memberCount, setMemberCount] = useState(0);
  const [showHomeInfo, setShowHomeInfo] = useState(false);

  useEffect(() => {
    getHomeMembers().then(members => setMemberCount(members.length));
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#1A1A1A] border-b border-[#333333] md:hidden pt-safe">
        <div className="flex items-center justify-between h-12 px-4">
          {/* Left: HomeSelector */}
          <button
            onClick={() => setShowHomeInfo(prev => !prev)}
            className="flex items-center gap-2 min-w-0"
          >
            <div className="w-7 h-7 rounded-lg bg-[#00B900]/20 flex items-center justify-center shrink-0">
              <HomeIcon className="w-3.5 h-3.5 text-[#00B900]" />
            </div>
            <span className="text-sm font-semibold text-white truncate max-w-[120px]">บ้านของฉัน</span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${showHomeInfo ? 'rotate-180' : ''}`} />
          </button>

          {/* Right: Profile + Notification */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push('/profile')}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
              aria-label="โปรไฟล์"
            >
              <User className="w-4.5 h-4.5" />
            </button>
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Home Info Dropdown */}
      {showHomeInfo && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setShowHomeInfo(false)}>
          <div className="absolute top-12 left-0 right-0 bg-[#1A1A1A] border-b border-[#333333] pt-safe">
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 bg-[#2A2A2A] rounded-lg p-3">
                <div className="w-10 h-10 rounded-lg bg-[#00B900]/20 flex items-center justify-center shrink-0">
                  <HomeIcon className="w-5 h-5 text-[#00B900]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">บ้านของฉัน</p>
                  {memberCount > 0 && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3" />
                      {memberCount} สมาชิก
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
