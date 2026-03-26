'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Repeat, Plus, Clock, Trash2, Bell, X, Loader2 } from 'lucide-react';
import { createRoutine, toggleRoutine, deleteRoutine } from '@/app/actions/routines';
import type { Routine } from '@/lib/db/routines';
import type { CreateRoutineInput } from '@/lib/db/routines';

const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const DAY_FULL_LABELS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function formatTime(time: string) {
  const [h, m] = time.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')} น.`;
}

function DayBadges({ days }: { days: number[] }) {
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="flex gap-1">
      {allDays.map((d) => (
        <span
          key={d}
          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
            days.includes(d)
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'bg-[#2A2A2A] text-gray-600 border border-[#333333]'
          }`}
        >
          {DAY_LABELS[d]}
        </span>
      ))}
    </div>
  );
}

interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateRoutineModal({ onClose, onCreated }: CreateModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);

    const input: CreateRoutineInput = {
      title: (data.get('title') as string).trim(),
      routine_time: data.get('routine_time') as string,
      days_of_week: selectedDays,
      remind_before_minutes: Number(data.get('remind_before_minutes') || 10),
    };

    const description = (data.get('description') as string).trim();
    if (description) input.description = description;

    if (!input.title) {
      setError('กรุณาใส่ชื่อกิจวัตร');
      return;
    }
    if (!input.routine_time) {
      setError('กรุณาระบุเวลา');
      return;
    }
    if (selectedDays.length === 0) {
      setError('กรุณาเลือกอย่างน้อย 1 วัน');
      return;
    }

    startTransition(async () => {
      const result = await createRoutine(input);
      if (result.success) {
        onCreated();
      } else {
        setError(result.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#1A1A1A] border border-[#333333] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Repeat className="w-4 h-4 text-purple-400" />
            </div>
            <h2 className="text-base font-semibold text-white">สร้างกิจวัตรใหม่</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* ชื่อ */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">
              ชื่อกิจวัตร <span className="text-red-400">*</span>
            </label>
            <input
              name="title"
              type="text"
              placeholder="เช่น ออกกำลังกาย, นั่งสมาธิ, อ่านหนังสือ"
              className="w-full h-10 px-3 rounded-lg border border-[#333333] bg-[#111111] text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-colors"
              required
            />
          </div>

          {/* คำอธิบาย */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">คำอธิบาย</label>
            <input
              name="description"
              type="text"
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
              className="w-full h-10 px-3 rounded-lg border border-[#333333] bg-[#111111] text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-colors"
            />
          </div>

          {/* เวลา */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">
              เวลา <span className="text-red-400">*</span>
            </label>
            <input
              name="routine_time"
              type="time"
              className="w-full h-10 px-3 rounded-lg border border-[#333333] bg-[#111111] text-white text-sm focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-colors [color-scheme:dark]"
              required
            />
          </div>

          {/* วันในสัปดาห์ */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              วันที่ทำ <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`flex-1 min-w-[36px] h-9 rounded-lg text-xs font-medium transition-colors ${
                    selectedDays.includes(day)
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                      : 'bg-[#2A2A2A] text-gray-500 border border-[#333333] hover:border-[#444444] hover:text-gray-300'
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {selectedDays.length === 7
                ? 'ทุกวัน'
                : selectedDays.length === 0
                ? 'ยังไม่ได้เลือกวัน'
                : selectedDays.map((d) => DAY_FULL_LABELS[d]).join(', ')}
            </p>
          </div>

          {/* แจ้งเตือนล่วงหน้า */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">แจ้งเตือนล่วงหน้า (นาที)</label>
            <select
              name="remind_before_minutes"
              defaultValue="10"
              className="w-full h-10 px-3 rounded-lg border border-[#333333] bg-[#111111] text-white text-sm focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-colors"
            >
              <option value="0">ไม่แจ้งเตือนล่วงหน้า</option>
              <option value="5">5 นาที</option>
              <option value="10">10 นาที</option>
              <option value="15">15 นาที</option>
              <option value="30">30 นาที</option>
              <option value="60">1 ชั่วโมง</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-[#333333] text-gray-300 text-sm font-medium hover:bg-[#2A2A2A] transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 h-10 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังสร้าง...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  สร้างกิจวัตร
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RoutineCardProps {
  routine: Routine;
  onRefresh: () => void;
}

function RoutineCard({ routine, onRefresh }: RoutineCardProps) {
  const [isToggling, startToggleTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const handleToggle = () => {
    startToggleTransition(async () => {
      await toggleRoutine(routine.id, !routine.is_active);
      onRefresh();
    });
  };

  const handleDelete = () => {
    if (!confirm(`ลบกิจวัตร "${routine.title}" ใช่ไหม?`)) return;
    startDeleteTransition(async () => {
      await deleteRoutine(routine.id);
      onRefresh();
    });
  };

  return (
    <div
      className={`bg-[#1A1A1A] border rounded-xl overflow-hidden transition-all ${
        routine.is_active
          ? 'border-[#333333] hover:border-[#444444]'
          : 'border-[#2A2A2A] opacity-60'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Left: icon + title */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                routine.is_active
                  ? 'bg-purple-500/20'
                  : 'bg-[#2A2A2A]'
              }`}
            >
              <Repeat
                className={`w-4.5 h-4.5 transition-colors ${
                  routine.is_active ? 'text-purple-400' : 'text-gray-500'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className={`text-sm font-semibold leading-snug truncate ${
                  routine.is_active ? 'text-white' : 'text-gray-400'
                }`}
              >
                {routine.title}
              </h3>
              {routine.description && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{routine.description}</p>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Toggle active */}
            <button
              onClick={handleToggle}
              disabled={isToggling || isDeleting}
              title={routine.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
              className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/40 disabled:cursor-not-allowed ${
                routine.is_active
                  ? 'bg-purple-600 hover:bg-purple-500'
                  : 'bg-[#333333] hover:bg-[#3A3A3A]'
              }`}
            >
              {isToggling ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </span>
              ) : (
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    routine.is_active ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              )}
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={isDeleting || isToggling}
              title="ลบกิจวัตร"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Time + days */}
        <div className="space-y-2 pl-12">
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className={`w-3.5 h-3.5 ${routine.is_active ? 'text-purple-400' : 'text-gray-500'}`} />
            <span className={routine.is_active ? 'text-gray-200' : 'text-gray-500'}>
              {formatTime(routine.routine_time)}
            </span>
            {routine.remind_before_minutes > 0 && (
              <>
                <span className="text-gray-600 mx-0.5">·</span>
                <Bell className="w-3 h-3 text-gray-500" />
                <span className="text-gray-500">
                  แจ้งเตือนก่อน{' '}
                  {routine.remind_before_minutes >= 60
                    ? `${routine.remind_before_minutes / 60} ชม.`
                    : `${routine.remind_before_minutes} นาที`}
                </span>
              </>
            )}
          </div>
          <DayBadges days={routine.days_of_week} />
        </div>
      </div>

      {/* Active status strip */}
      <div
        className={`h-0.5 transition-colors ${
          routine.is_active ? 'bg-purple-600/60' : 'bg-transparent'
        }`}
      />
    </div>
  );
}

interface RoutinesListProps {
  initialRoutines: Routine[];
}

export default function RoutinesList({ initialRoutines }: RoutinesListProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleRefresh = () => {
    router.refresh();
  };

  const handleCreated = () => {
    setShowCreateModal(false);
    router.refresh();
  };

  const activeRoutines = initialRoutines.filter((r) => r.is_active);
  const inactiveRoutines = initialRoutines.filter((r) => !r.is_active);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">กิจวัตร</h1>
          <p className="text-gray-400 text-sm">
            {initialRoutines.length > 0
              ? `${activeRoutines.length} รายการที่เปิดใช้งาน`
              : 'ตั้งกิจวัตรประจำวันของคุณ'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">สร้างกิจวัตร</span>
          <span className="sm:hidden">สร้าง</span>
        </button>
      </div>

      {/* Empty state */}
      {initialRoutines.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#333333] rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Repeat className="w-10 h-10 text-purple-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">ยังไม่มีกิจวัตร</h2>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto text-sm leading-relaxed">
            สร้างกิจวัตรประจำวันเพื่อให้แอปแจ้งเตือนคุณในเวลาที่กำหนด
          </p>
          <div className="text-left max-w-xs mx-auto space-y-2.5 mb-8">
            {[
              'ออกกำลังกายทุกเช้า 06:00 น.',
              'นั่งสมาธิ 07:30 น. ทุกวันจันทร์-ศุกร์',
              'อ่านหนังสือก่อนนอน 22:00 น.',
            ].map((example) => (
              <div key={example} className="flex items-start gap-2.5">
                <span className="text-purple-500 mt-0.5 text-sm">•</span>
                <span className="text-gray-300 text-sm">{example}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            สร้างกิจวัตรแรก
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active routines */}
          {activeRoutines.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                เปิดใช้งาน ({activeRoutines.length})
              </h2>
              <div className="space-y-3">
                {activeRoutines.map((routine) => (
                  <RoutineCard key={routine.id} routine={routine} onRefresh={handleRefresh} />
                ))}
              </div>
            </section>
          )}

          {/* Inactive routines */}
          {inactiveRoutines.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                ปิดใช้งาน ({inactiveRoutines.length})
              </h2>
              <div className="space-y-3">
                {inactiveRoutines.map((routine) => (
                  <RoutineCard key={routine.id} routine={routine} onRefresh={handleRefresh} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateRoutineModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
