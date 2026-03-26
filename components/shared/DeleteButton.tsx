'use client';

import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

interface DeleteButtonProps {
  onDelete: (id: string) => Promise<{ error?: string }>;
  itemId: string;
  itemName: string;
}

export default function DeleteButton({ onDelete, itemId, itemName }: DeleteButtonProps) {
  const router = useRouter();

  async function handleDelete() {
    const confirmed = window.confirm(`ยืนยันลบ "${itemName}" ไหม?`);
    if (!confirmed) return;

    const result = await onDelete(itemId);
    if (!result?.error) {
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
      title="ลบ"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
