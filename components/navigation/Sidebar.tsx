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
  Settings,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  CalendarDays,
  BarChart3
} from 'lucide-react';
import HomeSelector from '@/components/homes/HomeSelector';
import { Separator } from '@/components/ui/separator';
import NotificationBell from '@/components/notifications/NotificationBell';
import { getUserEvents } from '@/app/actions/events';
import { getUserTasks } from '@/app/actions/tasks';
import { getUserNotes } from '@/app/actions/notes';
import { getUserRoutines } from '@/app/actions/routines';
import { getUserMonthlyRoutines } from '@/app/actions/monthly-routines';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  path: string;
  badgeColor?: string;
}

const mainNavItems: NavItem[] = [
  { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'events', label: 'นัดหมาย', icon: Calendar, path: '/events', badgeColor: 'bg-[#00B900]' },
  { id: 'tasks', label: 'งาน', icon: CheckSquare, path: '/tasks', badgeColor: 'bg-blue-500' },
  { id: 'notes', label: 'บันทึก', icon: StickyNote, path: '/notes', badgeColor: 'bg-amber-500' },
  { id: 'routines', label: 'กิจวัตร', icon: Repeat, path: '/routines', badgeColor: 'bg-purple-500' },
  { id: 'monthly-routines', label: 'รายเดือน', icon: CalendarDays, path: '/monthly-routines', badgeColor: 'bg-pink-500' },
  { id: 'weekly-summary', label: 'รายสัปดาห์', icon: BarChart3, path: '/weekly-summary' },
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
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchCounts() {
      const [events, tasks, notes, routines, monthlyRoutines] = await Promise.all([
        getUserEvents(),
        getUserTasks(),
        getUserNotes(),
        getUserRoutines(),
        getUserMonthlyRoutines(),
      ]);
      setCounts({
        events: events.events?.length || 0,
        tasks: tasks.tasks?.filter(t => t.status === 'pending').length || 0,
        notes: notes.notes?.length || 0,
        routines: routines.routines?.filter(r => r.is_active).length || 0,
        'monthly-routines': monthlyRoutines.routines?.filter(r => r.is_active).length || 0,
      });
    }
    fetchCounts();
  }, [pathname]);

  const handleNavClick = (path: string) => {
    router.push(path);
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.path;
    const Icon = item.icon;
    const count = counts[item.id];

    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.path)}
        className={`relative flex items-center ${collapsed ? 'justify-center' : ''} w-full ${collapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg transition-all ${
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

        <div className="shrink-0 w-8 h-8 flex items-center justify-center">
          <Icon
            className={`w-5 h-5 transition-colors ${isActive ? 'text-[#00B900]' : ''}`}
            strokeWidth={isActive ? 2.5 : 2}
          />
        </div>

        {!collapsed && (
          <>
            <span className={`text-sm whitespace-nowrap ml-2 ${isActive ? 'font-semibold' : 'font-normal'}`}>
              {item.label}
            </span>
            <span className="flex-1" />
            {count !== undefined && count > 0 && item.badgeColor && (
              <span className={`flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold text-white ${item.badgeColor} rounded-full`}>
                {count > 99 ? '99+' : count}
              </span>
            )}
          </>
        )}

        {collapsed && count !== undefined && count > 0 && item.badgeColor && (
          <span className={`absolute -top-0.5 right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white ${item.badgeColor} rounded-full`}>
            {count > 99 ? '99+' : count}
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
        {!collapsed && (
          <p className="text-[10px] text-gray-600 text-center mt-1">v1.0.1</p>
        )}
      </div>
    </aside>
  );
}
