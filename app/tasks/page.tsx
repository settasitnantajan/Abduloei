import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserTasks, deleteTask } from '@/app/actions/tasks';
import { CheckSquare, Clock, Calendar, MessageCircle, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DeleteButton from '@/components/shared/DeleteButton';
import EditButton from '@/components/shared/EditButton';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import { updateTask } from '@/app/actions/tasks';
import { getHomeMembers } from '@/app/actions/home-members';

function getPriorityConfig(priority?: string) {
  switch (priority) {
    case 'high': return { label: 'ด่วน', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' };
    case 'low': return { label: 'ไม่ด่วน', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30' };
    default: return { label: 'ปกติ', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' };
  }
}

async function editTask(id: string, data: Record<string, unknown>) {
  'use server';
  return updateTask(id, data as any);
}

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { tasks, error: tasksError } = await getUserTasks();
  const members = await getHomeMembers();
  const memberOptions = [
    { label: 'ทุกคน', value: '' },
    ...members.map(m => ({ label: m.name, value: m.id }))
  ];

  const pendingTasks = tasks?.filter(t => t.status === 'pending') || [];
  const completedTasks = tasks?.filter(t => t.status === 'completed') || [];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">งาน</h1>
            <p className="text-gray-400 text-sm">จัดการงานที่ต้องทำ</p>
          </div>
          <CreateTaskModal />
        </div>

        {tasksError || !tasks || tasks.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-lg p-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center">
                <CheckSquare className="w-10 h-10 text-blue-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">ยังไม่มีงาน</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              เริ่มสร้างงานแรกของคุณผ่านแชท AI
            </p>
            <div className="text-left max-w-md mx-auto space-y-3 mb-8">
              <div className="flex items-start gap-3">
                <span className="text-blue-500 mt-1">•</span>
                <span className="text-gray-300">พิมพ์: &quot;ต้องซื้อของเข้าบ้าน&quot;</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-blue-500 mt-1">•</span>
                <span className="text-gray-300">พิมพ์: &quot;ต้องโทรหาช่างแอร์&quot;</span>
              </div>
            </div>
            <CreateTaskModal />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                  รอดำเนินการ ({pendingTasks.length})
                </h2>
                <div className="space-y-3">
                  {pendingTasks.map((task) => {
                    const priority = getPriorityConfig(task.priority);
                    return (
                      <div
                        key={task.id}
                        className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 hover:border-[#444444] transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <Circle className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-medium text-white">{task.title}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${priority.bg} ${priority.color} ${priority.border} border`}>
                                {priority.label}
                              </span>
                              <EditButton
                                onEdit={editTask}
                                itemId={task.id}
                                itemName={task.title}
                                accentColor="blue"
                                fields={[
                                  { key: 'title', label: 'ชื่องาน', type: 'text', value: task.title, required: true },
                                  { key: 'due_date', label: 'วันกำหนดส่ง', type: 'date', value: task.due_date || '' },
                                  { key: 'due_time', label: 'เวลา', type: 'time', value: task.due_time || '' },
                                  { key: 'priority', label: 'ความสำคัญ', type: 'select', value: task.priority || 'medium', options: [
                                    { label: 'ไม่ด่วน', value: 'low' }, { label: 'ปกติ', value: 'medium' }, { label: 'ด่วน', value: 'high' },
                                  ]},
                                  { key: 'description', label: 'คำอธิบาย', type: 'textarea', value: task.description || '' },
                                  { key: 'assigned_member_id', label: 'แจ้งเตือนใคร', type: 'select', value: (task as any).assigned_member_id || '', options: memberOptions },
                                ]}
                              />
                              <DeleteButton onDelete={deleteTask} itemId={task.id} itemName={task.title} />
                            </div>
                            {task.description && (
                              <p className="text-sm text-gray-400 mb-2">{task.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                              {task.due_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(task.due_date).toLocaleDateString('th-TH', {
                                    weekday: 'short', day: 'numeric', month: 'short',
                                  })}
                                </span>
                              )}
                              {task.due_time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {task.due_time} น.
                                </span>
                              )}
                            </div>
                            {task.source_message && (
                              <div className="mt-2 flex items-start gap-2 bg-[#111111] rounded-lg px-3 py-2 border border-[#2A2A2A]">
                                <MessageCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-gray-400">{task.source_message}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                  เสร็จแล้ว ({completedTasks.length})
                </h2>
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 opacity-60"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-medium text-gray-400 line-through">{task.title}</h3>
                            <DeleteButton onDelete={deleteTask} itemId={task.id} itemName={task.title} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
