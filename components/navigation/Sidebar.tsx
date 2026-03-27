'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  StickyNote,
  MessageCircle,
  Settings,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  CalendarDays
} from 'lucide-react';
import HomeSelector from '@/components/homes/HomeSelector';
import { Separator } from '@/components/ui/separator';
import NotificationBell from '@/components/notifications/NotificationBell';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  path: string;
}

const mainNavItems: NavItem[] = [
  { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'events', label: 'นัดหมาย', icon: Calendar, path: '/events' },
  { id: 'tasks', label: 'งาน', icon: CheckSquare, path: '/tasks' },
  { id: 'notes', label: 'บันทึก', icon: StickyNote, path: '/notes' },
  { id: 'routines', label: 'กิจวัตร', icon: Repeat, path: '/routines' },
  { id: 'monthly-routines', label: 'รายเดือน', icon: CalendarDays, path: '/monthly-routines' },
  { id: 'chat', label: 'แชท', icon: MessageCircle, path: '/chat' },
];

const secondaryNavItems: NavItem[] = [
  { id: 'settings', label: 'ตั้งค่า', icon: Settings, path: '/settings' },
  { id: 'profile', label: 'โปรไฟล์', icon: User, path: '/profile' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavClick = (path: string) => {
    router.push(path);
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.path;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.path)}
        className={`relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'} w-full ${collapsed ? 'px-2' : 'px-4'} py-3 rounded-lg transition-all ${
          isActive
            ? 'bg-[#00B900]/10 text-white'
            : 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]'
        }`}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
      >
        {isActive && (
          <motion.div
            layoutId="sidebarActiveIndicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#00B900] rounded-r-full"
            initial={false}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}

        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
          <Icon
            className={`w-5 h-5 transition-colors ${isActive ? 'text-[#00B900]' : ''}`}
            strokeWidth={isActive ? 2.5 : 2}
          />
        </div>

        {!collapsed && (
          <span className={`text-sm whitespace-nowrap ${isActive ? 'font-semibold' : 'font-normal'}`}>
            {item.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className={`hidden md:flex fixed left-0 top-0 bottom-0 bg-[#1A1A1A] border-r border-[#333333] flex-col z-40 transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className={collapsed ? 'p-3' : 'p-6'}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-full bg-[#00B900] flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold text-white">Abduloei</h1>
                <p className="text-xs text-gray-400">ผู้ช่วยอัจฉริยะ</p>
              </div>
            )}
          </div>
          {!collapsed && <NotificationBell />}
        </div>
        {collapsed && (
          <div className="flex justify-center mt-2">
            <NotificationBell />
          </div>
        )}
      </div>

      {/* Home Selector */}
      {!collapsed && (
        <div className="px-4 mb-6">
          <HomeSelector />
        </div>
      )}

      {/* Main Navigation */}
      <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-4'} space-y-1 overflow-y-auto`}>
        {mainNavItems.map(renderNavItem)}
      </nav>

      <div className={`${collapsed ? 'px-2' : 'px-4'} my-4`}>
        <Separator className="bg-[#333333]" />
      </div>

      {/* Secondary Navigation */}
      <nav className={`${collapsed ? 'px-2' : 'px-4'} space-y-1`}>
        {secondaryNavItems.map(renderNavItem)}
      </nav>

      {/* Collapse Toggle */}
      <div className={`${collapsed ? 'px-2' : 'px-4'} pb-4 pt-2`}>
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full py-2.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2A2A2A] transition-colors"
          title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2">
              <PanelLeftClose className="w-5 h-5" />
              <span className="text-xs">ย่อเมนู</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
