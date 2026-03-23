import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserMemories } from '@/app/actions/memories';
import MemoryList from '@/components/memories/MemoryList';

export default async function MemoriesPage() {
  // Check authentication
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user memories
  const { memories } = await getUserMemories();

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">ความทรงจำของ AI</h1>
          <p className="text-gray-400">สิ่งที่ AI จำได้เกี่ยวกับคุณ</p>
        </div>

        {memories.length === 0 ? (
          <div className="bg-[#1A1A1A] rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">🧠</div>
            <h2 className="text-xl font-semibold mb-2">ยังไม่มีความทรงจำ</h2>
            <p className="text-gray-400">
              เริ่มคุยกับ AI เพื่อสร้างความทรงจำครั้งแรก
              <br />
              AI จะจำข้อมูลสำคัญเกี่ยวกับคุณโดยอัตโนมัติ
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-400">
              พบ {memories.length} ความทรงจำ
            </div>
            <MemoryList memories={memories} />
          </>
        )}
      </div>
    </div>
  );
}
