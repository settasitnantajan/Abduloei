'use client';

import { useState } from 'react';
import { Calendar, List } from 'lucide-react';
import CalendarView from './CalendarView';
import TimelineView from './TimelineView';
import type { CalendarEvent } from './CalendarView';

interface DashboardTabsProps {
  events: CalendarEvent[];
}

export default function DashboardTabs({ events }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'timeline'>('calendar');

  return (
    <div>
      {/* Tab Switcher */}
      <div className="flex items-center bg-[#1A1A1A] border border-[#333333] rounded-xl p-1 mb-4">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'calendar'
              ? 'bg-[#2A2A2A] text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          ปฏิทิน
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'timeline'
              ? 'bg-[#2A2A2A] text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <List className="w-4 h-4" />
          รายการทั้งหมด
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'calendar' ? (
        <CalendarView events={events} />
      ) : (
        <TimelineView events={events} />
      )}
    </div>
  );
}
