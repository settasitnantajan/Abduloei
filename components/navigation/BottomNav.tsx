'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  StickyNote,
  MessageCircle,
  Repeat,
  CalendarDays,
  Settings,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'events', label: 'นัดหมาย', icon: Calendar, path: '/events' },
  { id: 'tasks', label: 'งาน', icon: CheckSquare, path: '/tasks' },
  { id: 'notes', label: 'บันทึก', icon: StickyNote, path: '/notes' },
  { id: 'chat', label: 'แชท', icon: MessageCircle, path: '/chat' },
  { id: 'routines', label: 'กิจวัตร', icon: Repeat, path: '/routines' },
  { id: 'monthly-routines', label: 'รายเดือน', icon: CalendarDays, path: '/monthly-routines' },
  { id: 'settings', label: 'ตั้งค่า', icon: Settings, path: '/settings' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  // เลื่อนไปหา active item อัตโนมัติ
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeEl = container.querySelector('[data-active="true"]') as HTMLElement;
    if (activeEl) {
      const left = activeEl.offsetLeft - container.offsetWidth / 2 + activeEl.offsetWidth / 2;
      container.scrollTo({ left, behavior: 'smooth' });
    }
  }, [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A1A1A] border-t border-[#333333] md:hidden pb-safe">
      <div
        ref={scrollRef}
        className="flex items-center h-16 overflow-x-auto scrollbar-hide"
      >
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              data-active={isActive}
              onClick={() => router.push(item.path)}
              className="relative flex flex-col items-center justify-center h-full min-w-[72px] px-2"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavActiveIndicator"
                  className="absolute top-0 left-0 right-0 h-0.5 bg-[#00B900]"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <div className="flex items-center justify-center h-9 w-9">
                <Icon
                  className={`h-5 w-5 transition-colors ${isActive ? 'text-[#00B900]' : 'text-gray-400'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>

              <span
                className={`text-[10px] mt-0.5 whitespace-nowrap transition-colors ${
                  isActive ? 'text-[#00B900] font-semibold' : 'text-gray-400 font-normal'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
