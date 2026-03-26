import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserNotes, deleteNote } from '@/app/actions/notes';
import { StickyNote, MessageCircle, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DeleteButton from '@/components/shared/DeleteButton';
import CreateNoteModal from '@/components/notes/CreateNoteModal';

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { notes, error: notesError } = await getUserNotes();

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">บันทึก</h1>
            <p className="text-gray-400 text-sm">บันทึกข้อมูลสำคัญ</p>
          </div>
          <CreateNoteModal />
        </div>

        {notesError || !notes || notes.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-lg p-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
                <StickyNote className="w-10 h-10 text-amber-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">ยังไม่มีบันทึก</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              เริ่มสร้างบันทึกแรกของคุณผ่านแชท AI
            </p>
            <div className="text-left max-w-md mx-auto space-y-3 mb-8">
              <div className="flex items-start gap-3">
                <span className="text-amber-500 mt-1">•</span>
                <span className="text-gray-300">พิมพ์: &quot;จำไว้ว่ารหัส wifi คือ 12345678&quot;</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-amber-500 mt-1">•</span>
                <span className="text-gray-300">พิมพ์: &quot;บันทึกไว้ว่าค่าไฟเดือนนี้ 2,500 บาท&quot;</span>
              </div>
            </div>
            <CreateNoteModal />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-5 hover:border-[#444444] transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-medium text-white">{note.title}</h3>
                  <div className="flex items-center gap-1.5">
                    {note.category && (
                      <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-400/30">
                        <Tag className="w-3 h-3" />
                        {note.category}
                      </span>
                    )}
                    <DeleteButton onDelete={deleteNote} itemId={note.id} itemName={note.title} />
                  </div>
                </div>

                {note.content && (
                  <p className="text-sm text-gray-400 mb-3 line-clamp-3">{note.content}</p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {new Date(note.created_at).toLocaleDateString('th-TH', {
                      day: 'numeric', month: 'short', year: '2-digit',
                    })}
                  </span>
                </div>

                {note.source_message && (
                  <div className="mt-3 flex items-start gap-2 bg-[#111111] rounded-lg px-3 py-2 border border-[#2A2A2A]">
                    <MessageCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-gray-400">{note.source_message}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
