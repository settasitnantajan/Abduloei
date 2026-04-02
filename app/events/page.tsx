import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserEvents, deleteEvent } from '@/app/actions/events';
import { Calendar, Clock, MessageCircle, CheckCircle2, Circle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DeleteButton from '@/components/shared/DeleteButton';
import EditButton, { EditField } from '@/components/shared/EditButton';
import CreateEventModal from '@/components/events/CreateEventModal';
import { updateEvent } from '@/app/actions/events';
import { getHomeMembers } from '@/app/actions/home-members';

function getPriorityConfig(priority?: string) {
  switch (priority) {
    case 'high': return { label: 'ด่วน', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' };
    case 'low': return { label: 'ไม่ด่วน', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30' };
    default: return { label: 'ปกติ', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' };
  }
}

function getStatusInfo(event: any) {
  const now = new Date();
  if (!event.event_date) return { label: 'ไม่มีวันที่', color: 'text-gray-400' };

  const eventDate = new Date(event.event_date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const diffDays = Math.ceil((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'ผ่านไปแล้ว', color: 'text-gray-500' };
  if (diffDays === 0) return { label: 'วันนี้', color: 'text-[#00B900]' };
  if (diffDays === 1) return { label: 'พรุ่งนี้', color: 'text-yellow-400' };
  return { label: `อีก ${diffDays} วัน`, color: 'text-gray-300' };
}

async function editEvent(id: string, data: Record<string, unknown>) {
  'use server';
  const mapped: Record<string, unknown> = {};
  if (data.title) mapped.title = data.title;
  if (data.event_date) mapped.event_date = data.event_date;
  if (data.event_time) mapped.event_time = data.event_time;
  if (data.description !== undefined) mapped.description = data.description;
  if (data.priority) mapped.priority = data.priority;
  return updateEvent(id, mapped);
}

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { events, error: eventsError } = await getUserEvents();
  const members = await getHomeMembers();
  const memberOptions = [
    { label: 'ทุกคน', value: '' },
    ...members.map(m => ({ label: m.name, value: m.id }))
  ];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">นัดหมาย</h1>
            <p className="text-gray-400 text-sm">นัดหมายและกิจกรรมของคุณ</p>
          </div>
          <CreateEventModal />
        </div>

        {/* Events List or Empty State */}
        {eventsError || !events || events.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-lg p-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-[#00B900]/10 flex items-center justify-center">
                <Calendar className="w-10 h-10 text-[#00B900]" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">ยังไม่มีนัดหมาย</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              เริ่มสร้างนัดหมายแรกของคุณผ่านแชท AI
            </p>
            <div className="text-left max-w-md mx-auto space-y-3 mb-8">
              <div className="flex items-start gap-3">
                <span className="text-[#00B900] mt-1">•</span>
                <span className="text-gray-300">พิมพ์: &quot;พรุ่งนี้ 2 โมงมีนัดหมอ&quot;</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[#00B900] mt-1">•</span>
                <span className="text-gray-300">พิมพ์: &quot;วันเสาร์ 10 โมงมีประชุม ต้องเตรียมเอกสาร&quot;</span>
              </div>
            </div>
            <CreateEventModal />
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const priority = getPriorityConfig(event.priority);
              const status = getStatusInfo(event);
              const completedItems = event.checklist_items?.filter(i => i.completed).length || 0;
              const totalItems = event.checklist_items?.length || 0;

              return (
                <div
                  key={event.id}
                  className="bg-[#1A1A1A] border border-[#333333] rounded-xl overflow-hidden hover:border-[#444444] transition-colors"
                >
                  {/* Header ของ Event */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-white">{event.title}</h3>
                          <EditButton
                            onEdit={editEvent}
                            itemId={event.id}
                            itemName={event.title}
                            accentColor="green"
                            fields={[
                              { key: 'title', label: 'ชื่อนัดหมาย', type: 'text', value: event.title, required: true },
                              { key: 'event_date', label: 'วันที่', type: 'date', value: event.event_date || '' },
                              { key: 'event_time', label: 'เวลา', type: 'time', value: event.event_time || '' },
                              { key: 'priority', label: 'ความสำคัญ', type: 'select', value: event.priority || 'medium', options: [
                                { label: 'ไม่ด่วน', value: 'low' }, { label: 'ปกติ', value: 'medium' }, { label: 'ด่วน', value: 'high' },
                              ]},
                              { key: 'description', label: 'รายละเอียด', type: 'textarea', value: event.description || '' },
                              { key: 'assigned_member_id', label: 'แจ้งเตือนใคร', type: 'select', value: event.assigned_member_id || '', options: memberOptions },
                            ]}
                          />
                          <DeleteButton onDelete={deleteEvent} itemId={event.id} itemName={event.title} />
                          <span className={`text-xs px-2 py-0.5 rounded-full ${priority.bg} ${priority.color} ${priority.border} border`}>
                            {priority.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          {event.event_date && (
                            <span className="flex items-center gap-1 text-gray-300">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(event.event_date).toLocaleDateString('th-TH', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          )}
                          {event.event_time && (
                            <span className="flex items-center gap-1 text-gray-300">
                              <Clock className="w-3.5 h-3.5" />
                              {event.event_time} น.
                            </span>
                          )}
                          <span className={`text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ข้อความแชทต้นทาง */}
                    {event.source_message && (
                      <div className="mt-3 flex items-start gap-2 bg-[#111111] rounded-lg px-3 py-2.5 border border-[#2A2A2A]">
                        <MessageCircle className="w-4 h-4 text-[#00B900] mt-0.5 shrink-0" />
                        <p className="text-sm text-gray-300 leading-relaxed">{event.source_message}</p>
                      </div>
                    )}

                    {/* รายละเอียดเพิ่มเติม */}
                    {event.description && (
                      <p className="mt-2 text-sm text-gray-400">{event.description}</p>
                    )}
                  </div>

                  {/* Checklist Items */}
                  {event.checklist_items && event.checklist_items.length > 0 && (
                    <div className="border-t border-[#2A2A2A] px-5 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 font-medium">
                          รายการ ({completedItems}/{totalItems})
                        </span>
                        {totalItems > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-[#333333] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#00B900] rounded-full transition-all"
                                style={{ width: `${(completedItems / totalItems) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {Math.round((completedItems / totalItems) * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {event.checklist_items
                          .sort((a, b) => a.order_index - b.order_index)
                          .map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            {item.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-[#00B900] shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-500 shrink-0" />
                            )}
                            <span className={item.completed ? 'text-gray-500 line-through' : 'text-gray-200'}>
                              {item.title}
                            </span>
                            {item.assignee && (
                              <span className="flex items-center gap-1 text-xs bg-[#2A2A2A] text-gray-400 px-2 py-0.5 rounded-full ml-auto">
                                <User className="w-3 h-3" />
                                {item.assignee}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
