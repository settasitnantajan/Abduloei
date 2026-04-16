'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createNote } from '@/app/actions/notes'

export default function CreateNoteModal() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')

  function resetForm() {
    setTitle('')
    setContent('')
    setCategory('')
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    startTransition(async () => {
      const result = await createNote({
        title: title.trim(),
        content: content.trim() || undefined,
        category: category.trim() || undefined,
      })

      if (result.success) {
        resetForm()
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error || 'ไม่สามารถสร้างบันทึกได้')
      }
    })
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-amber-600 hover:bg-amber-500 text-white"
      >
        <Plus className="w-5 h-5" />
        สร้างบันทึก
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[#333333]">
              <h2 className="text-lg font-semibold text-white">สร้างบันทึกใหม่</h2>
              <button onClick={() => { setOpen(false); resetForm() }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">ชื่อบันทึก *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="เช่น รหัส wifi"
                  required
                  className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">เนื้อหา</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="เนื้อหาบันทึก..."
                  rows={5}
                  className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">หมวดหมู่</label>
                <input
                  type="text"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="เช่น การเงิน, สุขภาพ"
                  className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <Button
                type="submit"
                disabled={isPending || !title.trim()}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isPending ? 'กำลังสร้าง...' : 'สร้างบันทึก'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
