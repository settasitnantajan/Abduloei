'use client';

import { Home as HomeIcon } from 'lucide-react';

export default function HomeSelector() {
  return (
    <div className="w-full flex items-center px-4 py-3 rounded-lg bg-[#2A2A2A]">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#00B900]/20 flex items-center justify-center">
          <HomeIcon className="w-5 h-5 text-[#00B900]" />
        </div>
        <p className="text-sm font-semibold text-white truncate">
          บ้านของฉัน
        </p>
      </div>
    </div>
  );
}
