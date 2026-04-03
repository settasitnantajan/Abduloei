'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Plus, Clock, Trash2, Bell, X, Loader2, Pencil } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { createMonthlyRoutine, toggleMonthlyRoutine, deleteMonthlyRoutine, updateMonthlyRoutine } from '@/app/actions/monthly-routines';
import { getHomeMembers } from '@/app/actions/home-members';
import type { MonthlyRoutine, CreateMonthlyRoutineInput } from '@/lib/db/monthly-routines';

function formatTime(time: string) {
  const [h, m] = time.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')} น.`;
}

function CreateMonthlyRoutineModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [assignedMemberId, setAssignedMemberId] = useState('');

  useEffect(() => {
    getHomeMembers().then(m => setMembers(m.map(x => ({ id: x.id, name: x.name }))));
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);

    const input: CreateMonthlyRoutineInput = {
      title: (data.get('title') as string).trim(),
      routine_time: data.get('routine_time') as string,
      day_of_month: Number(data.get('day_of_month') || 1),
      remind_before_minutes: Number(data.get('remind_before_minutes') || 10),
      assigned_member_id: assignedMemberId || undefined,
    };

    const description = (data.get('description') as string).trim();
    if (description) input.description = description;

    if (!input.title) { setError('กรุณาใส่ชื่อกิจวัตร'); return; }
    if (!input.routine_time) { setError('กรุณาระบุเวลา'); return; }

    startTransition(async () => {
      const result = await createMonthlyRoutine(input);
      if (result.success) {
        onCreated();
      } else {
        setError(result.error || 'เกิดข้อผิดพลาด');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-[#1A1A1A] border border-[#333333] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-pink-400" />
            </div>
            <h2 className="text-base font-semibold text-white">สร้างกิจวัตรรายเดือน</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pb-20 sm:pb-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">ชื่อ <span className="text-red-400">*</span></label>
            <input name="title" type="text" placeholder="เช่น จ่ายค่าบ้าน" className="w-full h-10 px-3 rounded-lg border border-[#333333] bg-[#111111] text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-pink-500/60 focus:ring-2 focus:ring-pink-500/20 transition-colors" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">คำอธิบาย</label>
            <input name="description" type="text" placeholder="รายละเอียดเพิ่มเติม" className="w-full h-10 px-3 rounded-lg border border-[#333333] bg-[#111111] text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-pink-500/60 focus:ring-2 focus:ring-pink-500/20 transition-colors" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">ทุกวันที่ <span className="text-red-400">*</span></label>
              <select name="day_of_month" defaultValue="1" className="w-full h-10 px-3 rounded-lg border border-[#333333] bg-[#111111] text-white text-sm focus:outline-none focus:border-pink-500/60 focus:ring-2 focus:ring-pink-500/20 transition-colors">
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>วันที่ {i + 1}</option>
                ))}
                <option value="32">สิ้นเดือน</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">เวลา <span className="text-red-400">*</span></label>
              <input name="routine_time" type="time" className="w-full h-10 px-3 rounded-lg border border-[#333333] bg-[#111111] text-white text-sm focus:outline-none focus:border-pink-500/60 focus:ring-2 focus:ring-pink-500/20 transition-colors [color-scheme:dark]" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">แจ้งเตือนล่วงหน้า (นาที)</label>
            <select name="remind_before_minutes" defaultValue="10" className="w-full h-10 px-3 rounded-lg border border-[#333333] bg-[#111111] text-white text-sm focus:outline-none focus:border-pink-500/60 focus:ring-2 focus:ring-pink-500/20 transition-colors">
              <option value="0">ไม่แจ้งเตือนล่วงหน้า</option>
              <option value="5">5 นาที</option>
              <option value="10">10 นาที</option>
              <option value="15">15 นาที</option>
              <option value="30">30 นาที</option>
              <option value="60">1 ชั่วโมง</option>
            </select>
          </div>

          {members.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">แจ้งเตือนใคร</label>
              <select
                value={assignedMemberId}
                onChange={e => setAssignedMemberId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#333333] bg-[#111111] text-white text-sm focus:outline-none focus:border-pink-500/60 focus:ring-2 focus:ring-pink-500/20 transition-colors"
              >
                <option value="">ทุกคน</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg border border-[#333333] text-gray-300 text-sm font-medium hover:bg-[#2A2A2A] transition-colors">ยกเลิก</button>
            <button type="submit" disabled={isPending} className="flex-1 h-10 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:bg-pink-600/50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังสร้าง...</> : <><Plus className="w-4 h-4" /> สร้าง</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MonthlyRoutineCard({ routine, onRefresh }: { routine: MonthlyRoutine; onRefresh: () => void }) {
  const [isToggling, startToggleTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditPending, startEditTransition] = useTransition();
  const [editTitle, setEditTitle] = useState(routine.title);
  const [editTime, setEditTime] = useState(routine.routine_time?.slice(0, 5) || '09:00');
  const [editDay, setEditDay] = useState(routine.day_of_month || 1);
  const [editRemind, setEditRemind] = useState(routine.remind_before_minutes ?? 10);
  const [editMemberId, setEditMemberId] = useState((routine as any).assigned_member_id || '');
  const [editMembers, setEditMembers] = useState<Array<{ id: string; name: string }>>([]);

  const handleToggle = () => {
    startToggleTransition(async () => {
      await toggleMonthlyRoutine(routine.id, !routine.is_active);
      onRefresh();
    });
  };

  const handleDelete = () => {
    if (!confirm(`ลบ "${routine.title}" ใช่ไหม?`)) return;
    startDeleteTransition(async () => {
      await deleteMonthlyRoutine(routine.id);
      onRefresh();
    });
  };

  const handleEditOpen = () => {
    setEditTitle(routine.title);
    setEditTime(routine.routine_time?.slice(0, 5) || '09:00');
    setEditDay(routine.day_of_month || 1);
    setEditRemind(routine.remind_before_minutes ?? 10);
    setEditMemberId((routine as any).assigned_member_id || '');
    getHomeMembers().then(m => setEditMembers(m.map(x => ({ id: x.id, name: x.name }))));
    setIsEditing(true);
  };

  const handleEditSave = () => {
    startEditTransition(async () => {
      await updateMonthlyRoutine(routine.id, {
        title: editTitle,
        routine_time: editTime,
        day_of_month: editDay,
        remind_before_minutes: editRemind,
        assigned_member_id: editMemberId || null,
      });
      setIsEditing(false);
      onRefresh();
    });
  };

  return (
    <div className={`bg-[#1A1A1A] border rounded-xl overflow-hidden transition-all ${routine.is_active ? 'border-[#333333] hover:border-[#444444]' : 'border-[#2A2A2A] opacity-60'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${routine.is_active ? 'bg-pink-500/20' : 'bg-[#2A2A2A]'}`}>
              <CalendarDays className={`w-4.5 h-4.5 transition-colors ${routine.is_active ? 'text-pink-400' : 'text-gray-500'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-semibold leading-snug truncate ${routine.is_active ? 'text-white' : 'text-gray-400'}`}>{routine.title}</h3>
              {routine.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{routine.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Switch checked={routine.is_active} onCheckedChange={handleToggle} disabled={isToggling || isDeleting} className="data-checked:bg-pink-600 data-unchecked:bg-[#444444]" />
            <button onClick={handleEditOpen} title="แก้ไข" className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-orange-400 hover:bg-orange-400/10 transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={handleDelete} disabled={isDeleting || isToggling} title="ลบ" className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:cursor-not-allowed disabled:opacity-40">
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2 pl-12">
          <div className="flex items-center gap-1.5 text-xs">
            <CalendarDays className={`w-3.5 h-3.5 ${routine.is_active ? 'text-pink-400' : 'text-gray-500'}`} />
            <span className={routine.is_active ? 'text-gray-200' : 'text-gray-500'}>{routine.day_of_month === 32 ? 'ทุกสิ้นเดือน' : `ทุกวันที่ ${routine.day_of_month}`}</span>
            <span className="text-gray-600 mx-0.5">·</span>
            <Clock className={`w-3.5 h-3.5 ${routine.is_active ? 'text-pink-400' : 'text-gray-500'}`} />
            <span className={routine.is_active ? 'text-gray-200' : 'text-gray-500'}>{formatTime(routine.routine_time)}</span>
            {routine.remind_before_minutes > 0 && (
              <>
                <span className="text-gray-600 mx-0.5">·</span>
                <Bell className="w-3 h-3 text-gray-500" />
                <span className="text-gray-500">เตือนก่อน {routine.remind_before_minutes >= 60 ? `${routine.remind_before_minutes / 60} ชม.` : `${routine.remind_before_minutes} นาที`}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className={`h-0.5 transition-colors ${routine.is_active ? 'bg-pink-600/60' : 'bg-transparent'}`} />

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsEditing(false)}>
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#333333]">
              <h2 className="text-lg font-semibold text-white">แก้ไขกิจวัตรรายเดือน</h2>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 pb-20 sm:pb-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">ชื่อ</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-pink-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">ทุกวันที่</label>
                  <select value={editDay} onChange={e => setEditDay(Number(e.target.value))} className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-pink-500">
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>วันที่ {i + 1}</option>
                    ))}
                    <option value="32">สิ้นเดือน</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">เวลา</label>
                  <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-pink-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">เตือนก่อน (นาที)</label>
                <input type="number" value={editRemind} onChange={e => setEditRemind(Number(e.target.value))} min={0} max={120} className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-pink-500" />
              </div>
              {editMembers.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">แจ้งเตือนใคร</label>
                  <select value={editMemberId} onChange={e => setEditMemberId(e.target.value)} className="w-full bg-[#2A2A2A] border border-[#333333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-pink-500">
                    <option value="">ทุกคน</option>
                    {editMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <button onClick={handleEditSave} disabled={isEditPending || !editTitle.trim()} className="w-full bg-pink-600 hover:bg-pink-500 text-white rounded-lg py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {isEditPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isEditPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MonthlyRoutinesList({ initialRoutines }: { initialRoutines: MonthlyRoutine[] }) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleRefresh = () => router.refresh();
  const handleCreated = () => { setShowCreateModal(false); router.refresh(); };

  const activeRoutines = initialRoutines.filter(r => r.is_active);
  const inactiveRoutines = initialRoutines.filter(r => !r.is_active);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">กิจวัตรรายเดือน</h1>
          <p className="text-gray-400 text-sm">
            {initialRoutines.length > 0 ? `${activeRoutines.length} รายการที่เปิดใช้งาน` : 'ตั้งกิจวัตรที่ทำทุกเดือน'}
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 h-10 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">สร้างรายเดือน</span>
          <span className="sm:hidden">สร้าง</span>
        </button>
      </div>

      {initialRoutines.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#333333] rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-pink-500/10 flex items-center justify-center">
              <CalendarDays className="w-10 h-10 text-pink-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">ยังไม่มีกิจวัตรรายเดือน</h2>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto text-sm leading-relaxed">สร้างกิจวัตรที่ต้องทำทุกเดือน เช่น จ่ายค่าบ้าน จ่ายค่าเน็ต</p>
          <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            สร้างกิจวัตรรายเดือนแรก
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {activeRoutines.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">เปิดใช้งาน ({activeRoutines.length})</h2>
              <div className="space-y-3">
                {activeRoutines.map(r => <MonthlyRoutineCard key={r.id} routine={r} onRefresh={handleRefresh} />)}
              </div>
            </section>
          )}
          {inactiveRoutines.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">ปิดใช้งาน ({inactiveRoutines.length})</h2>
              <div className="space-y-3">
                {inactiveRoutines.map(r => <MonthlyRoutineCard key={r.id} routine={r} onRefresh={handleRefresh} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {showCreateModal && <CreateMonthlyRoutineModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />}
    </>
  );
}
