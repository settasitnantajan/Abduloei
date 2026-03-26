'use client';

import NotificationBell from '@/components/notifications/NotificationBell';

export default function MobileHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#1A1A1A] border-b border-[#333333] md:hidden pt-safe">
      <div className="flex items-center justify-between h-12 px-4">
        <span className="text-base font-bold text-white">Abduloei</span>
        <NotificationBell />
      </div>
    </header>
  );
}
