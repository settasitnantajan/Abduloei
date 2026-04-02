'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MessageCircle, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react';
import { createNewConversation, deleteConversation, renameConversation } from '@/app/actions/chat';
import type { ChatConversation } from '@/app/actions/chat';

interface ChatRoomSidebarProps {
  conversations: ChatConversation[];
  activeId: string;
  onClose: () => void;
}

export default function ChatRoomSidebar({ conversations, activeId, onClose }: ChatRoomSidebarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  function handleSelectRoom(id: string) {
    router.push(`/chat?room=${id}`);
    onClose();
  }

  function handleNewRoom() {
    startTransition(async () => {
      const { conversation } = await createNewConversation();
      if (conversation) {
        router.push(`/chat?room=${conversation.id}`);
        onClose();
      }
    });
  }

  function handleDelete(id: string, title: string) {
    if (!confirm(`ลบห้อง "${title}"?`)) return;
    startTransition(async () => {
      await deleteConversation(id);
      if (id === activeId) {
        router.push('/chat');
      } else {
        router.refresh();
      }
      onClose();
    });
  }

  function startRename(conv: ChatConversation) {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  }

  function handleRename(id: string) {
    if (!editTitle.trim()) return;
    startTransition(async () => {
      await renameConversation(id, editTitle.trim());
      setEditingId(null);
      router.refresh();
    });
  }

  function timeLabel(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'วันนี้';
    if (days === 1) return 'เมื่อวาน';
    if (days < 7) return `${days} วันก่อน`;
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#1A1A1A] border-r border-[#333333] flex flex-col safe-area-inset">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333333]">
          <h2 className="text-base font-semibold text-white">ห้องแชท</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New room button */}
        <div className="p-3">
          <button
            onClick={handleNewRoom}
            disabled={isPending}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#00B900] hover:bg-[#00A000] text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            ห้องใหม่
          </button>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`group rounded-lg transition-colors ${
                conv.id === activeId
                  ? 'bg-[#00B900]/10 border border-[#00B900]/30'
                  : 'hover:bg-[#2A2A2A] border border-transparent'
              }`}
            >
              {editingId === conv.id ? (
                <div className="flex items-center gap-1 p-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(conv.id)}
                    className="flex-1 bg-[#111] border border-[#444] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#00B900]"
                    autoFocus
                  />
                  <button onClick={() => handleRename(conv.id)} className="p-1 text-[#00B900] hover:bg-[#00B900]/10 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-gray-500 hover:bg-[#2A2A2A] rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 cursor-pointer" onClick={() => handleSelectRoom(conv.id)}>
                  <MessageCircle className={`w-4 h-4 flex-shrink-0 ${conv.id === activeId ? 'text-[#00B900]' : 'text-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${conv.id === activeId ? 'text-white font-medium' : 'text-gray-300'}`}>
                      {conv.title}
                    </p>
                    <p className="text-[10px] text-gray-600">{timeLabel(conv.updated_at)}</p>
                  </div>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); startRename(conv); }}
                      className="p-1 text-gray-500 hover:text-white hover:bg-[#333] rounded"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(conv.id, conv.title); }}
                      className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {conversations.length === 0 && (
            <p className="text-sm text-gray-600 text-center py-8">ยังไม่มีห้องแชท</p>
          )}
        </div>
      </div>
    </>
  );
}
