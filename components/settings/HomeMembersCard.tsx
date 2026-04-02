'use client'

import { useState, useEffect, useTransition } from 'react'
import { getHomeMembers, createHomeMember, updateHomeMember, deleteHomeMember } from '@/app/actions/home-members'
import { getLinkingStatus } from '@/app/actions/line-linking'
import { Users, Plus, Pencil, Trash2, Loader2, X, Check, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Member {
  id: string
  name: string
  nickname: string | null
  line_user_id: string | null
  is_default: boolean
}

export default function HomeMembersCard() {
  const [members, setMembers] = useState<Member[]>([])
  const [lineAccounts, setLineAccounts] = useState<Array<{ id: string; lineUserId: string }>>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formNickname, setFormNickname] = useState('')
  const [formLineId, setFormLineId] = useState('')

  useEffect(() => {
    loadMembers()
  }, [])

  function loadMembers() {
    startTransition(async () => {
      const [data, linkStatus] = await Promise.all([getHomeMembers(), getLinkingStatus()])
      setMembers(data)
      setLineAccounts(linkStatus.accounts)
      setLoading(false)
    })
  }

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setFormName('')
    setFormNickname('')
    setFormLineId('')
    setError('')
  }

  function startEdit(member: Member) {
    setEditingId(member.id)
    setFormName(member.name)
    setFormNickname(member.nickname || '')
    setFormLineId(member.line_user_id || '')
    setShowForm(true)
    setError('')
  }

  function startAdd() {
    resetForm()
    setShowForm(true)
  }

  function handleSave() {
    if (!formName.trim()) {
      setError('กรุณาใส่ชื่อ')
      return
    }
    setError('')

    startTransition(async () => {
      if (editingId) {
        const result = await updateHomeMember(editingId, {
          name: formName.trim(),
          nickname: formNickname.trim() || null,
          line_user_id: formLineId.trim() || null,
        })
        if (result.error) {
          setError(result.error)
          return
        }
      } else {
        const result = await createHomeMember({
          name: formName.trim(),
          nickname: formNickname.trim() || undefined,
          line_user_id: formLineId.trim() || undefined,
        })
        if (result.error) {
          setError(result.error)
          return
        }
      }
      resetForm()
      loadMembers()
    })
  }

  function handleDelete(memberId: string, memberName: string) {
    if (!confirm(`ลบสมาชิก "${memberName}"?`)) return
    startTransition(async () => {
      const result = await deleteHomeMember(memberId)
      if (result.error) {
        setError(result.error)
      } else {
        setMembers(prev => prev.filter(m => m.id !== memberId))
      }
    })
  }

  if (loading) {
    return (
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">สมาชิกในบ้าน</h3>
            <p className="text-xs text-gray-400">{members.length} คน</p>
          </div>
        </div>
        {!showForm && (
          <Button
            onClick={startAdd}
            size="sm"
            className="bg-blue-600 hover:bg-blue-500 text-white h-8"
          >
            <Plus className="w-4 h-4 mr-1" />
            เพิ่ม
          </Button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* รายชื่อสมาชิก */}
      <div className="space-y-2 mb-4">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between bg-[#111111] border border-[#2A2A2A] rounded-lg px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#2A2A2A] flex items-center justify-center flex-shrink-0">
                {member.is_default ? (
                  <Crown className="w-4 h-4 text-yellow-400" />
                ) : (
                  <span className="text-sm text-gray-300">{member.name.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium truncate">{member.name}</span>
                  {member.nickname && (
                    <span className="text-xs text-gray-500">({member.nickname})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {member.line_user_id ? (
                    <span className="text-[10px] text-[#00B900]">LINE เชื่อมแล้ว</span>
                  ) : (
                    <span className="text-[10px] text-gray-600">ไม่มี LINE</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => startEdit(member)}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {!member.is_default && (
                <button
                  onClick={() => handleDelete(member.id, member.name)}
                  disabled={isPending}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Form เพิ่ม/แก้ไข */}
      {showForm && (
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-white">
            {editingId ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิกใหม่'}
          </p>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">ชื่อ *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="เช่น พี่แดง, แม่"
              className="w-full bg-[#0A0A0A] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">ชื่อเล่น (สำหรับ AI จับคู่)</label>
            <input
              type="text"
              value={formNickname}
              onChange={(e) => setFormNickname(e.target.value)}
              placeholder="เช่น แดง, ดง"
              className="w-full bg-[#0A0A0A] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">LINE (ถ้าเลือก จะเตือนตรงถึงคนนี้)</label>
            {lineAccounts.length > 0 ? (
              <select
                value={formLineId}
                onChange={(e) => setFormLineId(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">ไม่ระบุ (เตือนทุกคน)</option>
                {lineAccounts.map((acc, i) => (
                  <option key={acc.id} value={acc.lineUserId}>
                    LINE #{i + 1} ({acc.lineUserId.slice(0, 10)}...)
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-gray-600">ยังไม่มี LINE เชื่อม — เชื่อม LINE ก่อนที่ด้านบน</p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={handleSave}
              disabled={isPending}
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              {editingId ? 'บันทึก' : 'เพิ่ม'}
            </Button>
            <Button
              onClick={resetForm}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4 mr-1" />
              ยกเลิก
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 mt-3">
        เพิ่มสมาชิกเพื่อสั่งผ่านแชท เช่น &quot;สร้างนัดให้พี่แดง&quot;
      </p>
    </div>
  )
}
