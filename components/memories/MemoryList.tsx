'use client';

import { useState } from 'react';
import { type Memory } from '@/lib/ai/memory-utils';
import { removeMemory } from '@/app/actions/memories';
import { toast } from 'sonner';

interface MemoryListProps {
  memories: Memory[];
}

const categoryNames: Record<string, string> = {
  family: '👨‍👩‍👧‍👦 ครอบครัว',
  personal: '👤 ข้อมูลส่วนตัว',
  preferences: '❤️ ความชอบ',
  habits: '🔄 กิจวัตร',
  important_dates: '📅 วันสำคัญ',
  goals: '🎯 เป้าหมาย',
};

const categoryColors: Record<string, string> = {
  family: 'bg-blue-500/10 border-blue-500/20',
  personal: 'bg-purple-500/10 border-purple-500/20',
  preferences: 'bg-pink-500/10 border-pink-500/20',
  habits: 'bg-green-500/10 border-green-500/20',
  important_dates: 'bg-yellow-500/10 border-yellow-500/20',
  goals: 'bg-orange-500/10 border-orange-500/20',
};

export default function MemoryList({ memories: initialMemories }: MemoryListProps) {
  const [memories, setMemories] = useState(initialMemories);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('ต้องการลบความทรงจำนี้ใช่หรือไม่?')) {
      return;
    }

    setDeletingId(id);

    const { success, error } = await removeMemory(id);

    if (success) {
      toast.success('ลบความทรงจำแล้ว');
      setMemories(prev => prev.filter(m => m.id !== id));
    } else {
      toast.error(error || 'ไม่สามารถลบความทรงจำได้');
    }

    setDeletingId(null);
  };

  // Group memories by category
  const grouped = memories.reduce((acc, mem) => {
    if (!acc[mem.category]) acc[mem.category] = [];
    acc[mem.category].push(mem);
    return acc;
  }, {} as Record<string, Memory[]>);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, mems]) => (
        <div
          key={category}
          className={`rounded-lg border p-6 ${categoryColors[category] || 'bg-gray-500/10 border-gray-500/20'}`}
        >
          <h2 className="text-xl font-bold mb-4">
            {categoryNames[category] || category}
          </h2>
          <div className="space-y-3">
            {mems.map((mem) => (
              <div
                key={mem.id}
                className="flex items-start justify-between p-4 bg-black/30 rounded-lg hover:bg-black/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-gray-400 text-sm mb-1">
                    {mem.key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-white break-words">
                    {mem.value}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>
                      ความมั่นใจ: {Math.round(mem.confidence * 100)}%
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(mem.created_at).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(mem.id)}
                  disabled={deletingId === mem.id}
                  className="ml-4 text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {deletingId === mem.id ? 'กำลังลบ...' : 'ลบ'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
