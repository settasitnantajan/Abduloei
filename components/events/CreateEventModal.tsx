'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createEventWithChecklist } from '@/app/actions/events'
import { getHomeMembers } from '@/app/actions/home-members'

export default function CreateEventModal() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [location, setLocation] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [description, setDescription] = useState('')
  const [assignedMemberId, setAssignedMemberId] = useState('')
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (open) getHomeMembers().then(m => setMembers(m.map(x => ({ id: x.id, name: x.name }))))
  }, [open])

  function resetForm() {
    setTitle('')
    setEventDate('')
    setEventTime('')
    setLocation('')
    setPriority('medium')
    setDescription('')
    setAssignedMemberId('')
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    startTransition(async () => {
      const result = await createEventWithChecklist({
        title: title.trim(),
        event_date: eventDate || undefined,
        event_time: eventTime || undefined,
        location: location.trim() || undefined,
        priority,
        description: description.trim() || undefined,
        assigned_member_id: assignedMemberId || undefined,
      })

      if (result.success) {
        resetForm()
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error || 'ไม่สามารถสร้างนัดหมายได้')
      }
    })
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-[#00B900] hover:bg-[#00A000] text-white"
      >
        <Plus className="w-5 h-5" />
        สร้างนัดหมาย
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[#333333]">
              <h2 className="text-lg font-semibold text-white">สร้างนัดหมายใหม่</h2>
              <button onClick={() => { setOpen(false); resetForm() }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">ชื่อนัดหมาย *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="เช่น ประชุมทีม"
                  required
                  className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#00B900]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">วันที่</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00B900]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">เวลา</label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={e => setEventTime(e.target.value)}
                    className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00B900]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">สถานที่</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="เช่น ห้องประชุม A"
                  className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#00B900]"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">ระดับความสำคัญ</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00B900]"
                >
                  <option value="low">ไม่ด่วน</option>
                  <option value="medium">ปกติ</option>
                  <option value="high">ด่วน</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">คำอธิบาย</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติม..."
                  rows={3}
                  className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#00B900] resize-none"
                />
              </div>

              {members.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">แจ้งเตือนใคร</label>
                  <select
                    value={assignedMemberId}
                    onChange={e => setAssignedMemberId(e.target.value)}
                    className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00B900]"
                  >
                    <option value="">ทุกคน</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}

              <Button
                type="submit"
                disabled={isPending || !title.trim()}
                className="w-full bg-[#00B900] hover:bg-[#00A000] text-white disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isPending ? 'กำลังสร้าง...' : 'สร้างนัดหมาย'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
