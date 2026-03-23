'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatErrorStateProps {
  error: string;
}

export default function ChatErrorState({ error }: ChatErrorStateProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#1A1A1A] border border-[#333333] rounded-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">เกิดข้อผิดพลาด</h2>
        <p className="text-gray-400 mb-6">{error}</p>
        <div className="flex gap-4">
          <Button
            onClick={() => router.push('/dashboard')}
            className="flex-1 bg-[#2A2A2A] border-[#333333] text-white hover:bg-[#333333]"
          >
            กลับหน้าหลัก
          </Button>
          <Button
            onClick={() => router.refresh()}
            className="flex-1 bg-[#00B900] hover:bg-[#00A000] text-white"
          >
            ลองใหม่
          </Button>
        </div>
      </div>
    </div>
  );
}
