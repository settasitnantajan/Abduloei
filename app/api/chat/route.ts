import { NextRequest, NextResponse } from 'next/server';
import { generateAIResponse } from '@/lib/ai/gemini';
import { getChatMessages, saveChatMessage, queryCommands, getPendingCommand, markCommandExecuted, markCommandRejected, clearAllCommands } from '@/lib/db/chat';
import { createClient } from '@/lib/supabase/server';
import { detectConfirmation, generateConfirmationPrompt } from '@/lib/ai/confirmation-detector';
import { CommandMetadata } from '@/lib/types/command';
import { createEventWithChecklist, deleteAllEvents, deleteEventsByFilter, getUserEvents, updateEvent } from '@/lib/db/events';
import { createTask, deleteAllTasks, getUserTasks } from '@/lib/db/tasks';
import { createNote, deleteAllNotes, getUserNotes } from '@/lib/db/notes';
import { createRoutine, getUserRoutines } from '@/lib/db/routines';
import { buildAIContext, contextToPrompt, detectUserEmotion, getEmpatheticPrefix } from '@/lib/ai/context-builder';
import { processMessageForMemories } from '@/lib/db/memories';
import { searchWeb, formatSearchResults } from '@/lib/ai/web-searcher';
import { analyzeIntent, AnalyzedIntent } from '@/lib/ai/intent-analyzer';
import { parseThaiDate } from '@/lib/utils/thai-date-parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatRequestBody {
  conversationId: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: ChatRequestBody = await request.json();
    const { conversationId, message } = body;

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // Validate message
    if (message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'กรุณาพิมพ์ข้อความ' },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'ข้อความยาวเกินไป (สูงสุด 2000 ตัวอักษร)' },
        { status: 400 }
      );
    }

    // === Check if there's a pending command waiting for confirmation ===
    const { message: pendingMsg } = await getPendingCommand(conversationId);
    const confirmation = detectConfirmation(message);

    if (pendingMsg && confirmation !== 'none') {
      // User is responding to pending command
      const pendingMetadata = pendingMsg.metadata as unknown as CommandMetadata;

      if (confirmation === 'confirm') {
        // User confirmed → execute command
        const pendingCommand = pendingMetadata.command;

        // Save user message (confirmation)
        const { message: savedUserMessage } = await saveChatMessage(conversationId, 'user', message);

        let aiResponse: string;
        const typeMap: Record<string, string> = {
          create_event: 'นัดหมาย',
          create_task: 'งาน',
          create_note: 'บันทึก',
          create_routine: 'กิจวัตร',
          edit_event: 'แก้ไขนัดหมาย'
        };

        const typeName = typeMap[pendingCommand?.type || ''] || 'คำสั่ง';

        // Execute command based on type
        if (pendingCommand?.type === 'create_event') {
          const { success, error } = await createEventWithChecklist({
            title: pendingCommand.title,
            description: pendingCommand.description,
            event_date: pendingCommand.date,
            event_time: pendingCommand.time,
            priority: pendingCommand.priority,
            checklist_items: pendingCommand.checklist_items,
            source_message: pendingMetadata.command?.raw || message,
          });

          if (success) {
            await markCommandExecuted(pendingMsg.id);
            const checklistCount = pendingCommand.checklist_items?.length || 0;
            if (checklistCount > 0) {
              aiResponse = `สร้าง${typeName} "${pendingCommand.title}" พร้อม checklist ${checklistCount} รายการเรียบร้อยแล้วค่ะ ✅`;
            } else {
              aiResponse = `สร้าง${typeName} "${pendingCommand.title}" เรียบร้อยแล้วค่ะ ✅`;
            }
          } else {
            aiResponse = `ขอโทษค่ะ ไม่สามารถสร้าง${typeName}ได้: ${error}`;
          }
        } else if (pendingCommand?.type === 'create_task') {
          const { success, error } = await createTask({
            title: pendingCommand.title,
            description: pendingCommand.description,
            due_date: pendingCommand.date,
            due_time: pendingCommand.time,
            priority: pendingCommand.priority,
            source_message: pendingMetadata.command?.raw || message,
          });

          if (success) {
            await markCommandExecuted(pendingMsg.id);
            aiResponse = `สร้าง${typeName} "${pendingCommand.title}" เรียบร้อยแล้วค่ะ ✅`;
          } else {
            aiResponse = `ขอโทษค่ะ ไม่สามารถสร้าง${typeName}ได้: ${error}`;
          }
        } else if (pendingCommand?.type === 'create_routine') {
          const DAYS_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
          const { success, error } = await createRoutine({
            title: pendingCommand.title,
            description: pendingCommand.description,
            routine_time: pendingCommand.routine_time || '09:00',
            days_of_week: pendingCommand.days_of_week || [0, 1, 2, 3, 4, 5, 6],
            remind_before_minutes: pendingCommand.remind_before_minutes ?? 10,
            source_message: pendingMetadata.command?.raw || message,
          });

          if (success) {
            await markCommandExecuted(pendingMsg.id);
            const daysLabel = (pendingCommand.days_of_week || [0, 1, 2, 3, 4, 5, 6]).length === 7
              ? 'ทุกวัน'
              : (pendingCommand.days_of_week || []).map((d: number) => DAYS_TH[d]).join(' ');
            const timeStr = pendingCommand.routine_time || '09:00';
            const remindMin = pendingCommand.remind_before_minutes ?? 10;
            aiResponse = `สร้างกิจวัตร "${pendingCommand.title}" ${daysLabel} เวลา ${timeStr} น. (เตือนก่อน ${remindMin} นาที) เรียบร้อยแล้ว ✅`;
          } else {
            aiResponse = `ขอโทษค่ะ ไม่สามารถสร้างกิจวัตรได้: ${error}`;
          }
        } else if (pendingCommand?.type === 'create_note') {
          const { success, error } = await createNote({
            title: pendingCommand.title,
            content: pendingCommand.description,
            source_message: pendingMetadata.command?.raw || message,
          });

          if (success) {
            await markCommandExecuted(pendingMsg.id);
            aiResponse = `บันทึก "${pendingCommand.title}" เรียบร้อยแล้วค่ะ ✅`;
          } else {
            aiResponse = `ขอโทษค่ะ ไม่สามารถบันทึกได้: ${error}`;
          }
        } else if (pendingCommand?.type === 'delete_all') {
          // ลบข้อมูลตาม filter
          const filter = pendingCommand.deleteFilter;
          const isFilterAll = !filter || (filter.all && !filter.type && !filter.date && !filter.titleKeyword);
          const filterType = filter?.type;
          const filterDate = filter?.date;
          const filterTitle = filter?.titleKeyword;

          let eventsResult = { count: 0 };
          let tasksResult = { count: 0 };
          let notesResult = { count: 0 };

          if (filterTitle || filterDate) {
            // ลบเฉพาะรายการที่ match → ใช้ filter-based delete
            if (!filterType || filterType === 'create_event') {
              const result = await deleteEventsByFilter(filterDate, filterTitle);
              eventsResult = { count: result.count };
            }
            if (!filterType || filterType === 'create_task') {
              // tasks ไม่มี date filter เหมือน events, ใช้ title filter ผ่าน clearAllCommands
            }
            if (!filterType || filterType === 'create_note') {
              // notes ไม่มี date filter เหมือน events, ใช้ title filter ผ่าน clearAllCommands
            }
          } else {
            // ลบตามประเภท หรือลบทั้งหมด
            if (isFilterAll || filterType === 'create_event') {
              const result = await deleteAllEvents();
              eventsResult = { count: result.count };
            }
            if (isFilterAll || filterType === 'create_task') {
              const result = await deleteAllTasks();
              tasksResult = { count: result.count };
            }
            if (isFilterAll || filterType === 'create_note') {
              const result = await deleteAllNotes();
              notesResult = { count: result.count };
            }
          }

          // ลบ command metadata ที่ตรงกับ filter
          await clearAllCommands(conversationId, filterDate, filterType, filterTitle);
          await markCommandExecuted(pendingMsg.id);

          const totalDeleted = eventsResult.count + tasksResult.count + notesResult.count;
          const parts: string[] = [];
          if (eventsResult.count > 0) parts.push(`นัดหมาย ${eventsResult.count} รายการ`);
          if (tasksResult.count > 0) parts.push(`งาน ${tasksResult.count} รายการ`);
          if (notesResult.count > 0) parts.push(`บันทึก ${notesResult.count} รายการ`);

          if (totalDeleted > 0) {
            aiResponse = `ลบเรียบร้อยแล้วค่ะ ✅ (${parts.join(', ')})\n\nถ้าอยากสร้างนัดใหม่ บอกได้เลยนะคะ 😊`;
          } else {
            aiResponse = `ไม่มีรายการที่ต้องลบค่ะ ตอนนี้ว่างเปล่าแล้ว 😊`;
          }
        } else if (pendingCommand?.type === 'edit_event') {
          const targetEventId = pendingCommand.targetEventId;
          if (targetEventId) {
            const updates: { title?: string; event_date?: string; event_time?: string; description?: string } = {};
            if (pendingCommand.title) updates.title = pendingCommand.title;
            if (pendingCommand.date) updates.event_date = pendingCommand.date;
            if (pendingCommand.time) updates.event_time = pendingCommand.time;
            if (pendingCommand.description) updates.description = pendingCommand.description;

            const { success, error } = await updateEvent(targetEventId, updates);

            if (success) {
              await markCommandExecuted(pendingMsg.id);
              const changeParts: string[] = [];
              if (updates.title) changeParts.push(`ชื่อเป็น "${updates.title}"`);
              if (updates.event_date) {
                const d = new Date(updates.event_date);
                changeParts.push(`วันที่เป็น ${d.getDate()}/${d.getMonth() + 1}`);
              }
              if (updates.event_time) changeParts.push(`เวลาเป็น ${updates.event_time} น.`);
              aiResponse = `แก้ไขนัดหมายเรียบร้อยแล้วค่ะ ✅ (${changeParts.join(', ')})`;
            } else {
              aiResponse = `ขอโทษค่ะ ไม่สามารถแก้ไขนัดหมายได้: ${error}`;
            }
          } else {
            aiResponse = `ขอโทษค่ะ ไม่พบนัดหมายที่ต้องแก้ไข`;
          }
        } else {
          await markCommandExecuted(pendingMsg.id);
          aiResponse = `บันทึก "${pendingCommand?.title}" เรียบร้อยแล้วค่ะ ✅`;
        }

        // Save AI response
        const { message: savedAIMessage } = await saveChatMessage(conversationId, 'assistant', aiResponse);

        return NextResponse.json({
          success: true,
          userMessage: savedUserMessage,
          aiMessage: savedAIMessage
        });

      } else if (confirmation === 'reject') {
        // User rejected → mark as rejected
        await markCommandRejected(pendingMsg.id);

        // Save user message (rejection)
        const { message: savedUserMessage } = await saveChatMessage(conversationId, 'user', message);

        const aiResponse = `ยกเลิกแล้วค่ะ ❌ ถ้ามีอะไรให้ช่วย บอกได้เลยนะคะ 😊`;

        // Save AI response
        const { message: savedAIMessage } = await saveChatMessage(conversationId, 'assistant', aiResponse);

        return NextResponse.json({
          success: true,
          userMessage: savedUserMessage,
          aiMessage: savedAIMessage
        });
      }
    }

    // === Step 1: ใช้ AI วิเคราะห์ intent ของข้อความ ===
    let intent: AnalyzedIntent;
    try {
      intent = await analyzeIntent(message);
    } catch {
      intent = { intent: 'chat', raw: message };
    }

    console.log('[CHAT DEBUG] message:', message);
    console.log('[CHAT DEBUG] intent before override:', intent.intent, 'date:', intent.date);

    // Safety net: override intent ถ้า keyword ชัดเจน แต่ Gemini detect ผิด
    const { isQueryCommand: isQuery, isDeleteAllCommand: isDelete, isEditCommand: isEdit } = await import('@/lib/ai/keyword-parser');
    if (intent.intent !== 'query' && isQuery(message)) {
      console.log('[CHAT DEBUG] Override to query');
      intent = { ...intent, intent: 'query' };
      // parse date จากข้อความด้วย
      const pd = parseThaiDate(message);
      if (pd.date && !intent.date) {
        intent.date = pd.date;
      }
    } else if (intent.intent !== 'delete_all' && isDelete(message)) {
      console.log('[CHAT DEBUG] Override to delete_all');
      intent = { ...intent, intent: 'delete_all' };
    } else if (intent.intent !== 'edit_event' && isEdit(message)) {
      console.log('[CHAT DEBUG] Override to edit_event');
      intent = { ...intent, intent: 'edit_event' };
    }

    console.log('[CHAT DEBUG] intent after override:', intent.intent);

    // Build metadata for user message
    let userMetadata: CommandMetadata = {
      parsed: false,
      executed: false,
    };

    const isCommand = intent.intent === 'create_event' || intent.intent === 'create_task' || intent.intent === 'create_note' || intent.intent === 'create_routine' || intent.intent === 'delete_all' || intent.intent === 'edit_event';

    if (isCommand) {
      userMetadata = {
        command: {
          type: intent.intent as 'create_event' | 'create_task' | 'create_note' | 'create_routine' | 'delete_all' | 'edit_event',
          title: intent.title || message.slice(0, 50),
          date: intent.date,
          time: intent.time,
          description: intent.description,
          priority: intent.priority,
          checklist_items: intent.checklist_items,
          deleteFilter: intent.deleteFilter,
          editTarget: intent.editTarget,
          routine_time: intent.routine_time,
          days_of_week: intent.days_of_week,
          remind_before_minutes: intent.remind_before_minutes,
          raw: message,
        },
        parsed: true,
        executed: false,
        pending_confirmation: true,
      };
    }

    // Save user message (with metadata if command detected)
    const { message: savedUserMessage, error: saveUserError } = await saveChatMessage(
      conversationId,
      'user',
      message,
      userMetadata as unknown as Record<string, unknown>
    );

    if (saveUserError || !savedUserMessage) {
      return NextResponse.json(
        { error: 'Database Error', message: saveUserError || 'ไม่สามารถบันทึกข้อความได้' },
        { status: 500 }
      );
    }

    // Extract and store memories from user message (Phase 2: Long-term Memory)
    try {
      await processMessageForMemories(message, savedUserMessage.id);
    } catch (memoryError) {
      console.error('Memory extraction error:', memoryError);
    }

    // === Step 2: Execute web search if needed ===
    let searchResults = '';
    if (intent.intent === 'search') {
      try {
        const webSearchResult = await searchWeb(intent.searchQuery || message);
        searchResults = formatSearchResults(webSearchResult);
      } catch (searchError) {
        console.error('Search error:', searchError);
      }
    }

    // === Step 3: Handle query commands (มีนัดหมายอะไรบ้าง) ===
    let customQueryResponse: string | null = null;

    if (intent.intent === 'query') {
      console.log('[CHAT DEBUG] Entering query block');
      // ดึงข้อมูลจาก events/tasks/notes/routines table โดยตรง
      const [eventsResult, tasksResult, notesResult, routinesResult] = await Promise.all([
        getUserEvents(),
        getUserTasks(),
        getUserNotes(),
        getUserRoutines(),
      ]);

      // ตรวจว่าถามเฉพาะประเภทไหน
      const msgLower = message.toLowerCase();
      const askEvent = /นัด|หมาย|event|กิจกรรม|ประชุม/.test(msgLower);
      const askTask = /งาน|task|todo|ต้องทำ/.test(msgLower);
      const askNote = /บันทึก|โน้ต|note|เมโม|จด/.test(msgLower);
      const askRoutine = /กิจวัตร|routine|ประจำ|ทุกวัน/.test(msgLower);
      const askAll = (!askEvent && !askTask && !askNote && !askRoutine) || /ทั้งหมด|ทุกอย่าง/.test(msgLower);

      // รวมรายการตามที่ถาม
      type QueryItem = { type: string; title: string; date?: string; time?: string };
      const allItems: QueryItem[] = [];

      if (askAll || askEvent) {
        if (eventsResult.events) {
          for (const e of eventsResult.events) {
            allItems.push({ type: 'นัดหมาย', title: e.title, date: e.event_date, time: e.event_time });
          }
        }
      }
      if (askAll || askTask) {
        if (tasksResult.tasks) {
          for (const t of tasksResult.tasks) {
            allItems.push({ type: 'งาน', title: t.title, date: t.due_date, time: t.due_time });
          }
        }
      }
      if (askAll || askNote) {
        if (notesResult.notes) {
          for (const n of notesResult.notes) {
            allItems.push({ type: 'บันทึก', title: n.title });
          }
        }
      }
      if (askAll || askRoutine) {
        const DAYS_TH_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
        if (routinesResult.routines) {
          for (const r of routinesResult.routines) {
            const daysLabel = r.days_of_week.length === 7
              ? 'ทุกวัน'
              : r.days_of_week.map(d => DAYS_TH_SHORT[d]).join(',');
            allItems.push({
              type: 'กิจวัตร',
              title: `${r.title} (${daysLabel})`,
              time: r.routine_time?.slice(0, 5),
            });
          }
        }
      }

      // Filter ตามวันที่ถ้ามี
      const parsedDate = parseThaiDate(message);
      const queryDate = intent.date || parsedDate.date;
      const queryRange = parsedDate.dateRange;
      const queryBeforeDate = intent.beforeDate || parsedDate.beforeDate;
      const queryAfterDate = intent.afterDate || parsedDate.afterDate;

      let filtered = allItems;
      let filterLabel = '';

      if (queryBeforeDate) {
        filtered = filtered.filter(item => {
          if (!item.date) return false;
          return item.date < queryBeforeDate;
        });
        const d = new Date(queryBeforeDate);
        filterLabel = `ก่อนวันที่ ${d.getDate()}/${d.getMonth() + 1}`;
      } else if (queryAfterDate) {
        filtered = filtered.filter(item => {
          if (!item.date) return false;
          return item.date > queryAfterDate;
        });
        const d = new Date(queryAfterDate);
        filterLabel = `หลังวันที่ ${d.getDate()}/${d.getMonth() + 1}`;
      } else if (queryDate) {
        filtered = filtered.filter(item => item.date === queryDate);
        const d = new Date(queryDate);
        filterLabel = `วันที่ ${d.getDate()}/${d.getMonth() + 1}`;
      } else if (queryRange) {
        filtered = filtered.filter(item => {
          if (!item.date) return false;
          return item.date >= queryRange.from && item.date <= queryRange.to;
        });
        const from = new Date(queryRange.from);
        const to = new Date(queryRange.to);
        filterLabel = `${from.getDate()}/${from.getMonth() + 1} - ${to.getDate()}/${to.getMonth() + 1}`;
      }

      if (filtered.length > 0) {
        const commandsList = filtered.map(item => {
          let text = `${item.type}: ${item.title}`;
          if (item.date) {
            const date = new Date(item.date);
            text += ` (${date.getDate()}/${date.getMonth() + 1})`;
          }
          if (item.time) text += ` เวลา ${item.time} น.`;
          return text;
        }).join('\n');

        if (filterLabel) {
          customQueryResponse = `${filterLabel} มี ${filtered.length} รายการค่ะ:\n\n${commandsList}`;
        } else {
          customQueryResponse = `ตอนนี้มี ${filtered.length} รายการค่ะ:\n\n${commandsList}`;
        }
      } else {
        if (filterLabel) {
          customQueryResponse = `${filterLabel} ไม่มีนัดหมายหรืองานอะไรค่ะ 😊`;
        } else {
          customQueryResponse = 'ตอนนี้ยังไม่มีนัดหมายหรืองานอะไรเลยค่ะ 😊';
        }
      }
    }

    // Get conversation history (last 50 messages for enhanced context)
    const { messages: historyMessages } = await getChatMessages(conversationId, 50);

    const conversationHistory = historyMessages
      .filter(msg => msg.id !== savedUserMessage.id)
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

    // === Step 4: Generate AI response ===
    let aiResponse: string;
    try {
      if (isCommand && intent.intent === 'edit_event') {
        // Edit event → หานัดที่ match editTarget แล้วสร้าง confirmation
        const { events } = await getUserEvents();
        const editTarget = intent.editTarget;
        let matchedEvent: { id: string; title: string; event_date?: string; event_time?: string } | null = null;

        if (events && events.length > 0) {
          for (const e of events) {
            let match = true;
            if (editTarget?.date && e.event_date !== editTarget.date) match = false;
            if (editTarget?.titleKeyword && !e.title.toLowerCase().includes(editTarget.titleKeyword.toLowerCase())) match = false;
            if (match) {
              matchedEvent = { id: e.id, title: e.title, event_date: e.event_date, event_time: e.event_time };
              break;
            }
          }
        }

        if (matchedEvent) {
          // เก็บ targetEventId ใน metadata
          userMetadata.command!.targetEventId = matchedEvent.id;

          // อัปเดต metadata ที่ save ไปแล้ว
          await supabase
            .from('chat_messages')
            .update({ metadata: userMetadata as unknown as Record<string, unknown> })
            .eq('id', savedUserMessage.id);

          // สร้าง confirmation message
          const changeParts: string[] = [];
          if (intent.title) changeParts.push(`ชื่อเป็น "${intent.title}"`);
          if (intent.date) {
            const d = new Date(intent.date);
            changeParts.push(`วันที่เป็น ${d.getDate()}/${d.getMonth() + 1}`);
          }
          if (intent.time) changeParts.push(`เวลาเป็น ${intent.time} น.`);

          const oldDate = matchedEvent.event_date ? (() => { const d = new Date(matchedEvent!.event_date!); return `${d.getDate()}/${d.getMonth() + 1}`; })() : '';
          const changeDesc = changeParts.length > 0 ? changeParts.join(', ') : 'ไม่มีการเปลี่ยนแปลง';

          aiResponse = `ต้องการแก้ไขนัด "${matchedEvent.title}"${oldDate ? ` วันที่ ${oldDate}` : ''} → ${changeDesc} ใช่ไหมคะ?\n\n💬 พิมพ์ "ใช่" เพื่อยืนยัน หรือ "ไม่" เพื่อยกเลิก`;
        } else {
          aiResponse = 'ไม่พบนัดหมายที่ตรงกับเงื่อนไขค่ะ 😊 ลองเช็คชื่อหรือวันที่อีกครั้งนะคะ';
        }
      } else if (isCommand && intent.intent === 'delete_all') {
        // Delete command → ดึงรายการที่จะลบมาแสดงก่อน confirm
        const { commands } = await queryCommands(conversationId);
        const filter = intent.deleteFilter;
        const typeMap: Record<string, string> = {
          create_event: 'นัดหมาย',
          create_task: 'งาน',
          create_note: 'บันทึก'
        };

        // Filter ตามเงื่อนไข
        let filteredCommands = commands.filter(cmd => cmd.type !== 'delete_all');
        const hasSpecificFilter = filter && (filter.date || filter.type || filter.titleKeyword);

        if (hasSpecificFilter) {
          if (filter.date) {
            filteredCommands = filteredCommands.filter(cmd => cmd.date === filter.date);
          }
          if (filter.type) {
            filteredCommands = filteredCommands.filter(cmd => cmd.type === filter.type);
          }
          if (filter.titleKeyword) {
            const keyword = filter.titleKeyword.toLowerCase();
            filteredCommands = filteredCommands.filter(cmd =>
              cmd.title.toLowerCase().includes(keyword)
            );
          }
        }

        if (filteredCommands.length > 0) {
          const commandsList = filteredCommands.map(cmd => {
            const typeName = typeMap[cmd.type] || cmd.type;
            let text = `  • ${typeName}: ${cmd.title}`;
            if (cmd.date) {
              const date = new Date(cmd.date);
              text += ` (${date.getDate()}/${date.getMonth() + 1})`;
            }
            if (cmd.time) text += ` เวลา ${cmd.time} น.`;
            return text;
          }).join('\n');

          // สร้างคำอธิบายเงื่อนไขการลบ
          const descParts: string[] = [];
          if (filter?.type) {
            descParts.push(typeMap[filter.type] || '');
          }
          if (filter?.titleKeyword) {
            descParts.push(`"${filter.titleKeyword}"`);
          }
          if (filter?.date) {
            const d = new Date(filter.date);
            descParts.push(`วันที่ ${d.getDate()}/${d.getMonth() + 1}`);
          }
          const filterDesc = descParts.length > 0 ? descParts.join(' ') : 'ทั้งหมด';

          aiResponse = `⚠️ จะลบ${filterDesc} ${filteredCommands.length} รายการนี้:\n\n${commandsList}\n\nการลบจะย้อนกลับไม่ได้นะคะ\n\n💬 พิมพ์ "ใช่" เพื่อยืนยันลบ หรือ "ไม่" เพื่อยกเลิก`;
        } else {
          aiResponse = 'ไม่พบรายการที่ตรงกับเงื่อนไขค่ะ 😊';
        }
      } else if (isCommand && intent.intent === 'create_routine') {
        // Routine → show details before confirming
        const DAYS_TH_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
        const days = intent.days_of_week || [0, 1, 2, 3, 4, 5, 6];
        const daysLabel = days.length === 7
          ? 'ทุกวัน'
          : days.map(d => DAYS_TH_FULL[d]).join(', ');
        const timeStr = intent.routine_time || intent.time || '09:00';
        const remindMin = intent.remind_before_minutes ?? 10;

        aiResponse = `ยืนยันสร้างกิจวัตร "${intent.title}" ไหมคะ?\n\n` +
          `⏰ เวลา: ${timeStr} น.\n` +
          `📅 วัน: ${daysLabel}\n` +
          `🔔 เตือนก่อน: ${remindMin} นาที\n\n` +
          `💬 พิมพ์ "ใช่" เพื่อยืนยัน หรือ "ไม่" เพื่อยกเลิก`;
      } else if (isCommand) {
        // Create command → ask for confirmation
        aiResponse = generateConfirmationPrompt(intent.intent, intent.title || message.slice(0, 50));
      } else if (customQueryResponse) {
        aiResponse = customQueryResponse;
      } else {
        // Normal chat or search → call AI with context

        // 1. Build AI context (events, tasks, memories)
        const aiContext = await buildAIContext(conversationId, message, 50);
        let contextPrompt = contextToPrompt(aiContext);

        // 2. Add search results if available
        if (searchResults) {
          contextPrompt += '\n\n[ข้อมูลจากการค้นหา:]\n' + searchResults;
        }

        if (intent.intent === 'search' && !searchResults) {
          contextPrompt += '\n\n⚠️ ผู้ใช้ถามข้อมูลที่ต้องค้นหาจากอินเทอร์เน็ต แต่ระบบค้นหาไม่พร้อมใช้งาน — ตอบตามความรู้ที่มีอยู่ แล้วแจ้งผู้ใช้ว่าข้อมูลอาจไม่ใช่ล่าสุด';
        }

        // 3. Detect user emotion
        const { emotion } = detectUserEmotion(message);
        const emotionHint = emotion !== 'neutral' ? emotion : '';

        // 4. Generate response with full context
        aiResponse = await generateAIResponse(
          message,
          conversationHistory,
          contextPrompt,
          emotionHint
        );

        // 5. Add empathetic prefix if needed
        if (emotion === 'stressed' || emotion === 'happy') {
          const prefix = getEmpatheticPrefix(emotion);
          const lowerResponse = aiResponse.toLowerCase();
          if (!lowerResponse.includes('เข้าใจ') && !lowerResponse.includes('ดีใจ') && !lowerResponse.includes('ยินดี')) {
            aiResponse = prefix + aiResponse;
          }
        }
      }
    } catch (aiError) {
      console.error('AI generation error:', aiError);
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error('AI error details:', errMsg);

      if (errMsg === 'RATE_LIMIT') {
        aiResponse = 'ตอนนี้มีคนใช้งานเยอะ รอสักครู่แล้วลองใหม่นะครับ ⏳';
      } else {
        aiResponse = 'ขอโทษครับ ตอนนี้ผมมีปัญหาในการประมวลผล กรุณาลองใหม่อีกครั้งนะครับ 🙏';
      }
    }

    // Save AI response
    const { message: savedAIMessage, error: saveAIError } = await saveChatMessage(
      conversationId,
      'assistant',
      aiResponse
    );

    if (saveAIError || !savedAIMessage) {
      return NextResponse.json(
        { error: 'Database Error', message: saveAIError || 'ไม่สามารถบันทึกคำตอบได้' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      userMessage: savedUserMessage,
      aiMessage: savedAIMessage,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง'
      },
      { status: 500 }
    );
  }
}
