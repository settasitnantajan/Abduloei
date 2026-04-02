'use client';

import { useState, useEffect } from 'react';
import { Home as HomeIcon, Users } from 'lucide-react';
import { getHomeMembers } from '@/app/actions/home-members';

export default function HomeSelector() {
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    getHomeMembers().then(members => setMemberCount(members.length));
  }, []);

  return (
    <div className="w-full flex items-center px-4 py-3 rounded-lg bg-[#2A2A2A]">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#00B900]/20 flex items-center justify-center">
          <HomeIcon className="w-5 h-5 text-[#00B900]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            บ้านของฉัน
          </p>
          {memberCount > 0 && (
            <p className="text-[10px] text-gray-500 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {memberCount} สมาชิก
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
