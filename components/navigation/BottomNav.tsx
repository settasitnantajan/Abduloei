'use client';

import { useState, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  path: string;
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'ภาพรวม',
    icon: LayoutDashboard,
    path: '/dashboard'
  },
  {
    id: 'events',
    label: 'นัดหมาย',
    icon: Calendar,
    path: '/events'
  },
  {
    id: 'tasks',
    label: 'งาน',
    icon: CheckSquare,
    path: '/tasks'
  },
  {
    id: 'notes',
    label: 'บันทึก',
    icon: StickyNote,
    path: '/notes'
  },
  {
    id: 'chat',
    label: 'แชท',
    icon: MessageCircle,
    path: '/chat'
  },
  {
    id: 'routines',
    label: 'กิจวัตร',
    icon: Repeat,
    path: '/routines'
  },
  {
    id: 'monthly-routines',
    label: 'รายเดือน',
    icon: CalendarDays,
    path: '/monthly-routines'
  },
  {
    id: 'settings',
    label: 'ตั้งค่า',
    icon: Settings,
    path: '/settings'
  }
];

const VISIBLE_COUNT = 4;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const maxOffset = navItems.length - VISIBLE_COUNT;

  // ถ้า active item อยู่นอกช่วงที่แสดง ให้เลื่อนไปหา
  useEffect(() => {
    const activeIndex = navItems.findIndex(item => item.path === pathname);
    if (activeIndex >= 0) {
      if (activeIndex < offset) {
        setOffset(activeIndex);
      } else if (activeIndex >= offset + VISIBLE_COUNT) {
        setOffset(Math.min(activeIndex - VISIBLE_COUNT + 1, maxOffset));
      }
    }
  }, [pathname, offset, maxOffset]);

  const canGoLeft = offset > 0;
  const canGoRight = offset < maxOffset;

  const visibleItems = navItems.slice(offset, offset + VISIBLE_COUNT);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A1A1A] border-t border-[#333333] md:hidden pb-safe">
      <div className="flex items-center h-16">
        {/* ปุ่มเลื่อนซ้าย */}
        <button
          onClick={() => setOffset(prev => Math.max(prev - 1, 0))}
          className={`flex items-center justify-center w-8 h-full shrink-0 transition-colors ${
            canGoLeft ? 'text-gray-300 active:text-white' : 'text-[#2A2A2A]'
          }`}
          disabled={!canGoLeft}
          aria-label="เลื่อนซ้าย"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* เมนู 4 อัน */}
        <div className="flex items-center flex-1 h-full">
          {visibleItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => router.push(item.path)}
                className="relative flex flex-col items-center justify-center flex-1 h-full"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="bottomNavActiveIndicator"
                    className="absolute top-0 left-0 right-0 h-0.5 bg-[#00B900]"
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30
                    }}
                  />
                )}

                {/* Icon */}
                <div className="flex items-center justify-center h-9 w-9">
                  <Icon
                    className={`h-5 w-5 transition-colors ${
                      isActive ? 'text-[#00B900]' : 'text-gray-400'
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>

                {/* Label */}
                <span
                  className={`text-[10px] mt-0.5 transition-colors ${
                    isActive
                      ? 'text-[#00B900] font-semibold'
                      : 'text-gray-400 font-normal'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ปุ่มเลื่อนขวา */}
        <button
          onClick={() => setOffset(prev => Math.min(prev + 1, maxOffset))}
          className={`flex items-center justify-center w-8 h-full shrink-0 transition-colors ${
            canGoRight ? 'text-gray-300 active:text-white' : 'text-[#2A2A2A]'
          }`}
          disabled={!canGoRight}
          aria-label="เลื่อนขวา"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
