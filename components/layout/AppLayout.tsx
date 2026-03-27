'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/navigation/Sidebar';
import BottomNav from '@/components/navigation/BottomNav';
import MobileHeader from '@/components/navigation/MobileHeader';

interface AppLayoutProps {
  children: React.ReactNode;
}

// Routes that should have navigation
const navRoutes = ['/dashboard', '/events', '/tasks', '/notes', '/routines', '/monthly-routines', '/chat', '/settings', '/profile'];

// Routes that should NOT have navigation (auth pages, etc.)
const noNavRoutes = ['/login', '/forgot-password', '/reset-password', '/'];

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine if we should show navigation
  const shouldShowNav = navRoutes.some(route => pathname?.startsWith(route));
  const shouldHideNav = noNavRoutes.includes(pathname || '');

  const showNavigation = shouldShowNav && !shouldHideNav;

  if (!showNavigation) {
    // No navigation - render children as is
    return <>{children}</>;
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Mobile Header with NotificationBell */}
      <MobileHeader />

      {/* Main Content - with padding for sidebar on desktop, header+bottom nav on mobile */}
      <div
        className={`pt-12 pb-16 md:pt-0 md:pb-0 transition-all duration-300 ${
          sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-64'
        }`}
      >
        {children}
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </>
  );
}
