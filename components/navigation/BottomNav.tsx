'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  StickyNote,
  MessageCircle,
  Bell
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';

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
  }
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavClick = (path: string) => {
    router.push(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A1A1A] border-t border-[#333333] md:hidden pb-safe">
      <div className="flex items-center justify-around h-16">
        {/* Notification Bell for mobile */}
        <div className="relative flex flex-col items-center justify-center flex-1 h-full min-w-[44px]">
          <NotificationBell />
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.path)}
              className="relative flex flex-col items-center justify-center flex-1 h-full min-w-[44px]"
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
              <div className="flex items-center justify-center h-11 w-11">
                <Icon
                  className={`h-6 w-6 transition-colors ${
                    isActive ? 'text-[#00B900]' : 'text-gray-400'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>

              {/* Label */}
              <span
                className={`text-xs mt-0.5 transition-colors ${
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
    </nav>
  );
}
