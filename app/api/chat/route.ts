import { NextRequest, NextResponse } from 'next/server';
import { generateAIResponse } from '@/lib/ai/gemini';
import { getChatMessages, saveChatMessage, queryCommands, getPendingCommand, markCommandExecuted, markCommandRejected, clearAllCommands } from '@/lib/db/chat';
import { createClient } from '@/lib/supabase/server';
import { detectConfirmation } from '@/lib/ai/confirmation-detector';
import { CommandMetadata } from '@/lib/types/command';
import { createEventWithChecklist, deleteAllEvents, deleteEventsByFilter, getUserEvents, updateEvent, deleteEvent } from '@/lib/db/events';
import { createTask, deleteAllTasks, getUserTasks, updateTask, deleteTask } from '@/lib/db/tasks';
import { createNote, deleteAllNotes, getUserNotes, updateNote, deleteNote } from '@/lib/db/notes';
import { createRoutine, getUserRoutines, updateRoutine, deleteRoutine, deleteAllRoutines } from '@/lib/db/routines';
import { createMonthlyRoutine, getUserMonthlyRoutines, updateMonthlyRoutine, deleteMonthlyRoutine, deleteAllMonthlyRoutines } from '@/lib/db/monthly-routines';
import { buildAIContext, contextToPrompt, detectUserEmotion } from '@/lib/ai/context-builder';
import { processMessageForMemories } from '@/lib/db/memories';
import { searchWeb, formatSearchResults } from '@/lib/ai/web-searcher';
import { analyzeIntent, AnalyzedIntent } from '@/lib/ai/intent-analyzer';
import { parseThaiDate } from '@/lib/utils/thai-date-parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// === AI-generated messages แทน hardcoded templates ===
// ส่ง context ว่าเกิดอะไรขึ้นให้ AI แล้วให้ AI ตอบเองเป็นธรรมชาติ
async function generateActionResponse(
  systemContext: string,
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<string> {
  try {
    return await generateAIResponse(
      userMessage,
      conversationHistory,
      systemContext
    );
  } catch {
    return 'เรียบร้อยแล้วนะ ✅';
  }
}

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

        // ดึง history เพื่อให้ AI ตอบต่อเนื่อง
        const { messages: histMsgs } = await getChatMessages(conversationId, 20);
        const confirmHistory = histMsgs
          .filter(m => m.id !== savedUserMessage?.id)
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        let aiResponse: string;
        let actionContext: string | null = null; // context ให้ AI generate response
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
            const checklistNote = checklistCount > 0 ? ` พร้อม checklist ${checklistCount} รายการ` : '';
            actionContext = `สร้าง${typeName} "${pendingCommand.title}" สำเร็จแล้ว${checklistNote}`;
            aiResponse = ''; // จะ generate ด้วย AI ข้างล่าง
          } else {
            aiResponse = `ขอโทษนะ สร้าง${typeName}ไม่ได้: ${error}`;
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
            actionContext = `สร้าง${typeName} "${pendingCommand.title}" สำเร็จแล้ว`;
            aiResponse = '';
          } else {
            aiResponse = `ขอโทษนะ สร้าง${typeName}ไม่ได้: ${error}`;
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
            actionContext = `สร้างกิจวัตร "${pendingCommand.title}" ${daysLabel} เวลา ${timeStr} น. สำเร็จแล้ว`;
            aiResponse = '';
          } else {
            aiResponse = `ขอโทษนะ สร้างกิจวัตรไม่ได้: ${error}`;
          }
        } else if (pendingCommand?.type === 'create_monthly_routine') {
          const dayOfMonth = pendingCommand.day_of_month || 1;
          const { success, error } = await createMonthlyRoutine({
            title: pendingCommand.title,
            description: pendingCommand.description,
            routine_time: pendingCommand.routine_time || '09:00',
            day_of_month: dayOfMonth,
            remind_before_minutes: pendingCommand.remind_before_minutes ?? 10,
            source_message: pendingMetadata.command?.raw || message,
          });

          if (success) {
            await markCommandExecuted(pendingMsg.id);
            const timeStr = pendingCommand.routine_time || '09:00';
            const dayLabel = dayOfMonth === 32 ? 'สิ้นเดือน' : `วันที่ ${dayOfMonth}`;
            actionContext = `สร้างกิจวัตรรายเดือน "${pendingCommand.title}" ทุก${dayLabel} เวลา ${timeStr} น. สำเร็จแล้ว`;
            aiResponse = '';
          } else {
            aiResponse = `ขอโทษนะ สร้างกิจวัตรรายเดือนไม่ได้: ${error}`;
          }
        } else if (pendingCommand?.type === 'create_note') {
          const { success, error } = await createNote({
            title: pendingCommand.title,
            content: pendingCommand.description,
            source_message: pendingMetadata.command?.raw || message,
          });

          if (success) {
            await markCommandExecuted(pendingMsg.id);
            actionContext = `บันทึก "${pendingCommand.title}" สำเร็จแล้ว`;
            aiResponse = '';
          } else {
            aiResponse = `ขอโทษนะ บันทึกไม่ได้: ${error}`;
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
          let routinesResult = { count: 0 };
          let monthlyRoutinesResult = { count: 0 };

          if (filterTitle || filterDate) {
            if (!filterType || filterType === 'create_event') {
              const result = await deleteEventsByFilter(filterDate, filterTitle);
              eventsResult = { count: result.count };
            }
          } else {
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
            if (isFilterAll || filterType === 'create_routine') {
              const result = await deleteAllRoutines();
              routinesResult = { count: result.count };
            }
            if (isFilterAll) {
              const result = await deleteAllMonthlyRoutines();
              monthlyRoutinesResult = { count: result.count };
            }
          }

          await clearAllCommands(conversationId, filterDate, filterType, filterTitle);
          await markCommandExecuted(pendingMsg.id);

          const totalDeleted = eventsResult.count + tasksResult.count + notesResult.count + routinesResult.count + monthlyRoutinesResult.count;
          const parts: string[] = [];
          if (eventsResult.count > 0) parts.push(`นัดหมาย ${eventsResult.count} รายการ`);
          if (tasksResult.count > 0) parts.push(`งาน ${tasksResult.count} รายการ`);
          if (notesResult.count > 0) parts.push(`บันทึก ${notesResult.count} รายการ`);
          if (routinesResult.count > 0) parts.push(`กิจวัตร ${routinesResult.count} รายการ`);
          if (monthlyRoutinesResult.count > 0) parts.push(`กิจวัตรรายเดือน ${monthlyRoutinesResult.count} รายการ`);

          if (totalDeleted > 0) {
            actionContext = `ลบรายการสำเร็จแล้ว รวม ${totalDeleted} รายการ: ${parts.join(', ')}`;
            aiResponse = '';
          } else {
            actionContext = 'ไม่มีรายการอะไรให้ลบ ว่างเปล่า';
            aiResponse = '';
          }
        } else if (pendingCommand?.type === 'edit_event') {
          const targetId = pendingCommand.targetId || pendingCommand.targetEventId;
          if (targetId) {
            const updates: { title?: string; event_date?: string; event_time?: string; description?: string } = {};
            if (pendingCommand.title) updates.title = pendingCommand.title;
            if (pendingCommand.date) updates.event_date = pendingCommand.date;
            if (pendingCommand.time) updates.event_time = pendingCommand.time;
            if (pendingCommand.description) updates.description = pendingCommand.description;

            const { success, error } = await updateEvent(targetId, updates);
            if (success) {
              await markCommandExecuted(pendingMsg.id);
              actionContext = `แก้ไขนัดหมายสำเร็จแล้ว`;
              aiResponse = '';
            } else {
              aiResponse = `ขอโทษนะ แก้ไขนัดหมายไม่ได้: ${error}`;
            }
          } else {
            aiResponse = 'ไม่เจอนัดหมายที่จะแก้นะ ลองเช็คชื่ออีกทีได้ไหม';
          }
        } else if (pendingCommand?.type === 'edit_task') {
          const targetId = pendingCommand.targetId;
          if (targetId) {
            const updates: Record<string, unknown> = {};
            if (pendingCommand.title) updates.title = pendingCommand.title;
            if (pendingCommand.date) updates.due_date = pendingCommand.date;
            if (pendingCommand.time) updates.due_time = pendingCommand.time;
            if (pendingCommand.description) updates.description = pendingCommand.description;
            if (pendingCommand.priority) updates.priority = pendingCommand.priority;

            const { success, error } = await updateTask(targetId, updates);
            if (success) {
              await markCommandExecuted(pendingMsg.id);
              actionContext = `แก้ไขงานสำเร็จแล้ว`;
              aiResponse = '';
            } else {
              aiResponse = `ขอโทษนะ แก้ไขงานไม่ได้: ${error}`;
            }
          } else {
            aiResponse = 'ไม่เจองานที่จะแก้นะ ลองเช็คชื่ออีกทีได้ไหม';
          }
        } else if (pendingCommand?.type === 'edit_note') {
          const targetId = pendingCommand.targetId;
          if (targetId) {
            const updates: Record<string, unknown> = {};
            if (pendingCommand.title) updates.title = pendingCommand.title;
            if (pendingCommand.description) updates.content = pendingCommand.description;

            const { success, error } = await updateNote(targetId, updates);
            if (success) {
              await markCommandExecuted(pendingMsg.id);
              actionContext = `แก้ไขบันทึกสำเร็จแล้ว`;
              aiResponse = '';
            } else {
              aiResponse = `ขอโทษนะ แก้ไขบันทึกไม่ได้: ${error}`;
            }
          } else {
            aiResponse = 'ไม่เจอบันทึกที่จะแก้นะ ลองเช็คชื่ออีกทีได้ไหม';
          }
        } else if (pendingCommand?.type === 'edit_routine') {
          const targetId = pendingCommand.targetId;
          if (targetId) {
            const updates: Record<string, unknown> = {};
            if (pendingCommand.title) updates.title = pendingCommand.title;
            if (pendingCommand.routine_time) updates.routine_time = pendingCommand.routine_time;
            if (pendingCommand.days_of_week) updates.days_of_week = pendingCommand.days_of_week;
            if (pendingCommand.remind_before_minutes != null) updates.remind_before_minutes = pendingCommand.remind_before_minutes;

            const { success, error } = await updateRoutine(targetId, updates);
            if (success) {
              await markCommandExecuted(pendingMsg.id);
              actionContext = `แก้ไขกิจวัตรสำเร็จแล้ว`;
              aiResponse = '';
            } else {
              aiResponse = `ขอโทษนะ แก้ไขกิจวัตรไม่ได้: ${error}`;
            }
          } else {
            aiResponse = 'ไม่เจอกิจวัตรที่จะแก้นะ ลองเช็คชื่ออีกทีได้ไหม';
          }
        } else if (pendingCommand?.type === 'edit_monthly_routine') {
          const targetId = pendingCommand.targetId;
          if (targetId) {
            const updates: Record<string, unknown> = {};
            if (pendingCommand.title) updates.title = pendingCommand.title;
            if (pendingCommand.routine_time) updates.routine_time = pendingCommand.routine_time;
            if (pendingCommand.day_of_month) updates.day_of_month = pendingCommand.day_of_month;
            if (pendingCommand.remind_before_minutes != null) updates.remind_before_minutes = pendingCommand.remind_before_minutes;

            const { success, error } = await updateMonthlyRoutine(targetId, updates);
            if (success) {
              await markCommandExecuted(pendingMsg.id);
              actionContext = `แก้ไขกิจวัตรรายเดือนสำเร็จแล้ว`;
              aiResponse = '';
            } else {
              aiResponse = `ขอโทษนะ แก้ไขกิจวัตรรายเดือนไม่ได้: ${error}`;
            }
          } else {
            aiResponse = 'ไม่เจอกิจวัตรรายเดือนที่จะแก้นะ ลองเช็คชื่ออีกทีได้ไหม';
          }
        } else if (pendingCommand?.type === 'delete_event') {
          const targetId = pendingCommand.targetId;
          if (targetId) {
            const { success, error } = await deleteEvent(targetId);
            if (success) {
              await markCommandExecuted(pendingMsg.id);
              actionContext = `ลบนัดหมาย "${pendingCommand.title}" สำเร็จแล้ว`;
              aiResponse = '';
            } else {
              aiResponse = `ขอโทษนะ ลบนัดหมายไม่ได้: ${error}`;
            }
          } else {
            aiResponse = 'ไม่เจอนัดหมายที่จะลบนะ';
          }
        } else if (pendingCommand?.type === 'delete_task') {
          const targetId = pendingCommand.targetId;
          if (targetId) {
            const { success, error } = await deleteTask(targetId);
            if (success) {
              await markCommandExecuted(pendingMsg.id);
              actionContext = `ลบงาน "${pendingCommand.title}" สำเร็จแล้ว`;
              aiResponse = '';
            } else {
              aiResponse = `ขอโทษนะ ลบงานไม่ได้: ${error}`;
            }
          } else {
            aiResponse = 'ไม่เจองานที่จะลบนะ';
          }
        } else if (pendingCommand?.type === 'delete_note') {
          const targetId = pendingCommand.targetId;
          if (targetId) {
            const { success, error } = await deleteNote(targetId);
            if (success) {
              await markCommandExecuted(pendingMsg.id);
              actionContext = `ลบบันทึก "${pendingCommand.title}" สำเร็จแล้ว`;
              aiResponse = '';
            } else {
              aiResponse = `ขอโทษนะ ลบบันทึกไม่ได้: ${error}`;
            }
          } else {
            aiResponse = 'ไม่เจอบันทึกที่จะลบนะ';
          }
        } else if (pendingCommand?.type === 'delete_routine') {
          const targetId = pendingCommand.targetId;
          if (targetId) {
            const { success, error } = await deleteRoutine(targetId);
            if (success) {
              await markCommandExecuted(pendingMsg.id);
              actionContext = `ลบกิจวัตร "${pendingCommand.title}" สำเร็จแล้ว`;
              aiResponse = '';
            } else {
              aiResponse = `ขอโทษนะ ลบกิจวัตรไม่ได้: ${error}`;
            }
          } else {
            aiResponse = 'ไม่เจอกิจวัตรที่จะลบนะ';
          }
        } else if (pendingCommand?.type === 'delete_monthly_routine') {
          const targetId = pendingCommand.targetId;
          if (targetId) {
            const { success, error } = await deleteMonthlyRoutine(targetId);
            if (success) {
              await markCommandExecuted(pendingMsg.id);
              actionContext = `ลบกิจวัตรรายเดือน "${pendingCommand.title}" สำเร็จแล้ว`;
              aiResponse = '';
            } else {
              aiResponse = `ขอโทษนะ ลบกิจวัตรรายเดือนไม่ได้: ${error}`;
            }
          } else {
            aiResponse = 'ไม่เจอกิจวัตรรายเดือนที่จะลบนะ';
          }
        } else {
          await markCommandExecuted(pendingMsg.id);
          actionContext = `ดำเนินการ "${pendingCommand?.title || 'รายการ'}" สำเร็จแล้ว`;
          aiResponse = '';
        }

        // ถ้ามี actionContext → ให้ AI generate response เอง
        if (actionContext && !aiResponse) {
          aiResponse = await generateActionResponse(
            `[สถานะระบบ: ${actionContext}] — user เพิ่งยืนยันคำสั่ง ระบบทำเสร็จแล้ว แจ้ง user สั้นๆ`,
            message,
            confirmHistory
          );
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

        // ดึง history เพื่อให้ AI ตอบต่อเนื่อง
        const { messages: rejectHistMsgs } = await getChatMessages(conversationId, 20);
        const rejectHistory = rejectHistMsgs
          .filter(m => m.id !== savedUserMessage?.id)
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        const pendingTitle = pendingMetadata.command?.title || 'คำสั่ง';
        const pendingType = pendingMetadata.command?.type || '';
        const aiResponse = await generateActionResponse(
          `[สถานะระบบ: user ยกเลิกคำสั่ง${pendingType ? ` (${pendingType})` : ''} "${pendingTitle}"] — user ไม่ต้องการทำต่อ แจ้ง user สั้นๆ`,
          message,
          rejectHistory
        );

        // Save AI response
        const { message: savedAIMessage } = await saveChatMessage(conversationId, 'assistant', aiResponse);

        return NextResponse.json({
          success: true,
          userMessage: savedUserMessage,
          aiMessage: savedAIMessage
        });
      }
    }

    // === ถ้ามี pending command แต่ user ไม่ได้ตอบ ใช่/ไม่ → ยกเลิก pending แล้ว process ข้อความใหม่ ===
    if (pendingMsg && confirmation === 'none') {
      // User ไม่ได้ confirm/reject แต่พิมพ์อย่างอื่นมา → ยกเลิก pending command เดิม
      await markCommandRejected(pendingMsg.id);
      console.log('[CHAT DEBUG] Pending command auto-rejected — user sent new message instead of confirm/reject');
    }

    // === Step 0.5: ตรวจจับว่าผู้ใช้ตอบตัวเลขเลือก clarify choice ===
    let resolvedMessage = message;
    const numberMatch = message.trim().match(/^(\d+)$/);
    if (numberMatch) {
      // ดึงข้อความล่าสุดของ assistant เพื่อดูว่าเป็น clarify choices หรือเปล่า
      const { messages: recentMessages } = await getChatMessages(conversationId, 5);
      const lastAssistantMsg = recentMessages
        .filter(m => m.role === 'assistant')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (lastAssistantMsg) {
        // ตรวจจับ pattern "1. xxx\n2. xxx\n3. xxx" ในข้อความ assistant
        const choiceMatches = lastAssistantMsg.content.match(/^\d+\.\s+(.+)$/gm);
        if (choiceMatches && choiceMatches.length > 0) {
          const choiceIndex = parseInt(numberMatch[1]) - 1;
          if (choiceIndex >= 0 && choiceIndex < choiceMatches.length) {
            // ดึงข้อความ choice ที่เลือก (เอาเฉพาะ text หลังเลข)
            const selectedChoice = choiceMatches[choiceIndex].replace(/^\d+\.\s+/, '').trim();
            console.log('[CHAT DEBUG] User selected clarify choice:', selectedChoice);
            resolvedMessage = selectedChoice;
          }
        }
      }
    }

    // === Step 1: ใช้ AI วิเคราะห์ intent ของข้อความ ===
    // ถ้าข้อความก่อนหน้าเป็น clarify → รวม context เพื่อให้ AI เข้าใจว่าตอบอะไร
    let intentMessage = resolvedMessage;
    {
      const { messages: recentMsgs } = await getChatMessages(conversationId, 10);
      const sorted = recentMsgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // นับ clarify ติดต่อกัน (assistant ถามคำถาม → user ตอบ = 1 รอบ)
      // ถ้าเกิน 3 รอบ ไม่รวม context (ป้องกัน loop)
      let clarifyCount = 0;
      for (const m of sorted) {
        if (m.role === 'assistant') {
          const text = m.content.trim();
          const isQuestion = /[?？]$/.test(text) || /คะ\??$|ครับ\??$|ค่ะ\??$/.test(text);
          if (isQuestion) clarifyCount++;
          else break;
        }
        // ข้าม user messages เพื่อนับ assistant ย้อนหลัง
      }

      const lastAssistant = sorted.find(m => m.role === 'assistant');
      const lastUser = sorted.find(m => m.role === 'user');

      if (clarifyCount >= 3) {
        console.log('[CHAT DEBUG] Clarify loop limit (3) → skip context merge, treat as fresh');
      } else if (lastAssistant && lastUser && lastAssistant.created_at > lastUser.created_at) {
        // เช็คว่า assistant จบด้วยคำถาม → อาจเป็น clarify follow-up
        const assistantText = lastAssistant.content.trim();
        const endsWithQuestion = /[?？]$/.test(assistantText)
          || /คะ\??$|ครับ\??$|ค่ะ\??$|ไหม\??$|บ้าง\??$|เท่าไหร่\??$|อะไร\??$/.test(assistantText);

        if (endsWithQuestion) {
          // ตรวจว่า user ตอบข้อมูลเพิ่มจริง หรือเปลี่ยนเรื่อง/ยกเลิก
          const userReply = resolvedMessage.trim().toLowerCase();
          const isCancelling = /ช่างเถอะ|ไม่เอา|ยกเลิก|เปลี่ยน|ไม่ต้อง|ไม่แล้ว|ลืมไป|ไม่ใช่|skip|cancel/.test(userReply);
          const isChangingTopic = /สวัสดี|เหนื่อย|555|ขอบคุณ|ดีใจ|เบื่อ|เศร้า|หิว|ง่วง|ทำไรดี/.test(userReply);
          const isNewCommand = /สร้าง|ลบ|แก้ไข|มีนัด|ดูงาน|ซื้อ|จำไว้/.test(userReply);

          if (isCancelling || isChangingTopic || isNewCommand) {
            // ไม่รวม context — ปล่อยให้ AI วิเคราะห์ข้อความใหม่ตามปกติ
            console.log('[CHAT DEBUG] User changed topic or cancelled → skip context merge');
          } else {
            // น่าจะเป็นคำตอบต่อจาก clarify → รวม context
            intentMessage = `${lastUser.content} ${resolvedMessage}`;
            console.log('[CHAT DEBUG] Combined clarify context:', intentMessage);
          }
        }
      }
    }

    let intent: AnalyzedIntent;
    try {
      intent = await analyzeIntent(intentMessage);
    } catch {
      intent = { intent: 'chat', raw: resolvedMessage };
    }

    console.log('[CHAT DEBUG] message:', message);
    console.log('[CHAT DEBUG] intent:', intent.intent, 'date:', intent.date, 'time:', intent.time);

    // === Safety net: validate + บังคับ clarify ถ้าข้อมูลไม่ครบหรือมั่ว ===
    // ตรวจ date/time format ที่ AI ส่งมา — ถ้าไม่ valid ถือว่าไม่มี
    if (intent.date && !/^\d{4}-\d{2}-\d{2}$/.test(intent.date)) {
      console.log('[CHAT DEBUG] Invalid date format:', intent.date, '→ remove');
      intent.date = undefined;
    }
    if (intent.time && !/^\d{2}:\d{2}$/.test(intent.time)) {
      console.log('[CHAT DEBUG] Invalid time format:', intent.time, '→ remove');
      intent.time = undefined;
    }
    if (intent.routine_time && !/^\d{2}:\d{2}$/.test(intent.routine_time)) {
      console.log('[CHAT DEBUG] Invalid routine_time format:', intent.routine_time, '→ remove');
      intent.routine_time = undefined;
    }

    // ตรวจวันที่ผ่านไปแล้ว — ถ้า date < วันนี้ → clarify ถามใหม่
    if (intent.date && /^\d{4}-\d{2}-\d{2}$/.test(intent.date)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const intentDate = new Date(intent.date + 'T00:00:00');
      if (intentDate < today) {
        console.log('[CHAT DEBUG] Date is in the past:', intent.date, '→ force clarify');
        const titleHint = intent.title ? `"${intent.title}" ` : '';
        intent = {
          ...intent,
          intent: 'clarify',
          clarifyMessage: `${titleHint}วันที่ ${intent.date} ผ่านไปแล้วนะคะ ต้องการวันไหนแทนคะ?`,
          choices: [],
        };
      }
    }

    if (intent.intent === 'create_event' && (!intent.date || !intent.time)) {
      const missing: string[] = [];
      if (!intent.date) missing.push('วันที่');
      if (!intent.time) missing.push('เวลา');
      console.log('[CHAT DEBUG] Missing fields for create_event:', missing.join(', '), '→ force clarify');
      const titleHint = intent.title ? `เข้าใจว่าอยาก${intent.title} ` : '';
      intent = {
        ...intent,
        intent: 'clarify',
        clarifyMessage: `${titleHint}ขอทราบ${missing.join('และ')}ด้วยนะคะ`,
        choices: [],
      };
    } else if (intent.intent === 'create_routine' && !intent.routine_time && !intent.time) {
      console.log('[CHAT DEBUG] Missing routine_time for create_routine → force clarify');
      const titleHint = intent.title ? `"${intent.title}" ` : '';
      intent = {
        ...intent,
        intent: 'clarify',
        clarifyMessage: `อยากตั้งกิจวัตร ${titleHint}กี่โมงคะ?`,
        choices: [],
      };
    } else if (intent.intent === 'create_monthly_routine' && !intent.day_of_month) {
      console.log('[CHAT DEBUG] Missing day_of_month for create_monthly_routine → force clarify');
      const titleHint = intent.title ? `"${intent.title}" ` : '';
      intent = {
        ...intent,
        intent: 'clarify',
        clarifyMessage: `อยากตั้งกิจวัตรรายเดือน ${titleHint}ทุกวันที่เท่าไหร่ของเดือนคะ?`,
        choices: [],
      };
    }

    // Build metadata for user message
    let userMetadata: CommandMetadata = {
      parsed: false,
      executed: false,
    };

    const nonCommandIntents = ['query', 'chat', 'search', 'clarify'];
    const isCommand = !nonCommandIntents.includes(intent.intent);

    if (isCommand) {
      userMetadata = {
        command: {
          type: intent.intent as any,
          title: intent.title || resolvedMessage.slice(0, 50),
          date: intent.date,
          day_of_month: intent.day_of_month,
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
          customQueryResponse = `${filterLabel} มี ${filtered.length} รายการนะ:\n\n${commandsList}`;
        } else {
          customQueryResponse = `ตอนนี้มี ${filtered.length} รายการนะ:\n\n${commandsList}`;
        }
      } else {
        if (filterLabel) {
          customQueryResponse = `${filterLabel} ไม่มีอะไรเลยนะ ว่างๆ 😊`;
        } else {
          customQueryResponse = 'ตอนนี้ยังไม่มีอะไรเลยนะ ว่างๆ 😊';
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
          // เก็บ targetId ใน metadata
          userMetadata.command!.targetId = matchedEvent.id;
          userMetadata.command!.targetEventId = matchedEvent.id;

          // อัปเดต metadata ที่ save ไปแล้ว
          await supabase
            .from('chat_messages')
            .update({ metadata: userMetadata as unknown as Record<string, unknown> })
            .eq('id', savedUserMessage.id);

          // สร้าง confirmation message ผ่าน AI
          const changeParts: string[] = [];
          if (intent.title) changeParts.push(`ชื่อเป็น "${intent.title}"`);
          if (intent.date) {
            const d = new Date(intent.date);
            changeParts.push(`วันที่เป็น ${d.getDate()}/${d.getMonth() + 1}`);
          }
          if (intent.time) changeParts.push(`เวลาเป็น ${intent.time} น.`);

          const oldDate = matchedEvent.event_date ? (() => { const d = new Date(matchedEvent!.event_date!); return `${d.getDate()}/${d.getMonth() + 1}`; })() : '';
          const changeDesc = changeParts.length > 0 ? changeParts.join(', ') : 'ไม่มีการเปลี่ยนแปลง';

          aiResponse = await generateActionResponse(
            `[สถานะระบบ: user ต้องการแก้ไขนัด "${matchedEvent.title}"${oldDate ? ` วันที่ ${oldDate}` : ''} → ${changeDesc}] — ถาม user ยืนยันสั้นๆ ลงท้ายว่า พิมพ์ "ใช่" หรือ "ไม่"`,
            message,
            conversationHistory
          );
        } else {
          aiResponse = await generateActionResponse(
            `[สถานะระบบ: ไม่พบนัดหมายที่ตรงกับเงื่อนไขที่ user พูดถึง] — แจ้ง user สั้นๆ แนะนำให้เช็คชื่อหรือวันที่`,
            message,
            conversationHistory
          );
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

          aiResponse = await generateActionResponse(
            `[สถานะระบบ: user ต้องการลบ${filterDesc} ${filteredCommands.length} รายการ:\n${commandsList}\nการลบจะย้อนกลับไม่ได้] — ถาม user ยืนยัน ลงท้ายว่า พิมพ์ "ใช่" หรือ "ไม่"`,
            message,
            conversationHistory
          );
        } else {
          aiResponse = await generateActionResponse(
            `[สถานะระบบ: ไม่พบรายการที่ตรงกับเงื่อนไขที่ user ต้องการลบ] — แจ้ง user สั้นๆ`,
            message,
            conversationHistory
          );
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

        aiResponse = await generateActionResponse(
          `[สถานะระบบ: user ต้องการสร้างกิจวัตร "${intent.title}" เวลา ${timeStr} น. ${daysLabel} เตือนก่อน ${remindMin} นาที] — สรุปรายละเอียดให้ user แล้วถามยืนยัน ลงท้ายว่า พิมพ์ "ใช่" หรือ "ไม่"`,
          message,
          conversationHistory
        );
      } else if (isCommand && intent.intent === 'create_monthly_routine') {
        const dayOfMonth = intent.day_of_month || 1;
        const dayLabel = dayOfMonth === 32 ? 'สิ้นเดือน' : `วันที่ ${dayOfMonth}`;
        const timeStr = intent.routine_time || intent.time || '09:00';
        const remindMin = intent.remind_before_minutes ?? 10;

        aiResponse = await generateActionResponse(
          `[สถานะระบบ: user ต้องการสร้างกิจวัตรรายเดือน "${intent.title}" ทุก${dayLabel} ของเดือน เวลา ${timeStr} น. เตือนก่อน ${remindMin} นาที] — สรุปรายละเอียดให้ user แล้วถามยืนยัน ลงท้ายว่า พิมพ์ "ใช่" หรือ "ไม่"`,
          message,
          conversationHistory
        );
      } else if (isCommand && (intent.intent === 'edit_task' || intent.intent === 'edit_note' || intent.intent === 'edit_routine' || intent.intent === 'edit_monthly_routine')) {
        // Edit task/note/routine/monthly_routine → หารายการที่ match
        const editTarget = intent.editTarget;
        const keyword = editTarget?.titleKeyword?.toLowerCase() || '';
        let matched: { id: string; title: string } | null = null;
        let typeName = '';

        if (intent.intent === 'edit_task') {
          typeName = 'งาน';
          const { tasks } = await getUserTasks();
          matched = tasks?.find(t => t.title.toLowerCase().includes(keyword)) ? { id: tasks.find(t => t.title.toLowerCase().includes(keyword))!.id, title: tasks.find(t => t.title.toLowerCase().includes(keyword))!.title } : null;
        } else if (intent.intent === 'edit_note') {
          typeName = 'บันทึก';
          const { notes } = await getUserNotes();
          matched = notes?.find(n => n.title.toLowerCase().includes(keyword)) ? { id: notes.find(n => n.title.toLowerCase().includes(keyword))!.id, title: notes.find(n => n.title.toLowerCase().includes(keyword))!.title } : null;
        } else if (intent.intent === 'edit_routine') {
          typeName = 'กิจวัตร';
          const { routines } = await getUserRoutines();
          matched = routines?.find(r => r.title.toLowerCase().includes(keyword)) ? { id: routines.find(r => r.title.toLowerCase().includes(keyword))!.id, title: routines.find(r => r.title.toLowerCase().includes(keyword))!.title } : null;
        } else if (intent.intent === 'edit_monthly_routine') {
          typeName = 'กิจวัตรรายเดือน';
          const { routines } = await getUserMonthlyRoutines();
          matched = routines?.find(r => r.title.toLowerCase().includes(keyword)) ? { id: routines.find(r => r.title.toLowerCase().includes(keyword))!.id, title: routines.find(r => r.title.toLowerCase().includes(keyword))!.title } : null;
        }

        if (matched) {
          userMetadata.command!.targetId = matched.id;
          await supabase
            .from('chat_messages')
            .update({ metadata: userMetadata as unknown as Record<string, unknown> })
            .eq('id', savedUserMessage.id);

          const changeParts: string[] = [];
          if (intent.title) changeParts.push(`ชื่อเป็น "${intent.title}"`);
          if (intent.date) changeParts.push(`วันที่เป็น ${intent.date}`);
          if (intent.time) changeParts.push(`เวลาเป็น ${intent.time} น.`);
          if (intent.routine_time) changeParts.push(`เวลาเป็น ${intent.routine_time} น.`);
          if (intent.day_of_month) changeParts.push(`วันที่ ${intent.day_of_month} ของเดือน`);
          if (intent.description) changeParts.push(`รายละเอียดเป็น "${intent.description}"`);
          const changeDesc = changeParts.length > 0 ? changeParts.join(', ') : '';

          aiResponse = await generateActionResponse(
            `[สถานะระบบ: user ต้องการแก้ไข${typeName} "${matched.title}" → ${changeDesc}] — ถาม user ยืนยันสั้นๆ ลงท้ายว่า พิมพ์ "ใช่" หรือ "ไม่"`,
            message,
            conversationHistory
          );
        } else {
          aiResponse = await generateActionResponse(
            `[สถานะระบบ: ไม่พบ${typeName}ที่ชื่อ "${keyword}"] — แจ้ง user สั้นๆ แนะนำให้เช็คชื่อ`,
            message,
            conversationHistory
          );
        }
      } else if (isCommand && (intent.intent === 'delete_event' || intent.intent === 'delete_task' || intent.intent === 'delete_note' || intent.intent === 'delete_routine' || intent.intent === 'delete_monthly_routine')) {
        // Delete specific item → หารายการที่ match
        const editTarget = intent.editTarget;
        const keyword = editTarget?.titleKeyword?.toLowerCase() || '';
        let matched: { id: string; title: string } | null = null;
        let typeName = '';

        if (intent.intent === 'delete_event') {
          typeName = 'นัดหมาย';
          const { events } = await getUserEvents();
          const found = events?.find(e => e.title.toLowerCase().includes(keyword));
          if (found) matched = { id: found.id, title: found.title };
        } else if (intent.intent === 'delete_task') {
          typeName = 'งาน';
          const { tasks } = await getUserTasks();
          const found = tasks?.find(t => t.title.toLowerCase().includes(keyword));
          if (found) matched = { id: found.id, title: found.title };
        } else if (intent.intent === 'delete_note') {
          typeName = 'บันทึก';
          const { notes } = await getUserNotes();
          const found = notes?.find(n => n.title.toLowerCase().includes(keyword));
          if (found) matched = { id: found.id, title: found.title };
        } else if (intent.intent === 'delete_routine') {
          typeName = 'กิจวัตร';
          const { routines } = await getUserRoutines();
          const found = routines?.find(r => r.title.toLowerCase().includes(keyword));
          if (found) matched = { id: found.id, title: found.title };
        } else if (intent.intent === 'delete_monthly_routine') {
          typeName = 'กิจวัตรรายเดือน';
          const { routines } = await getUserMonthlyRoutines();
          const found = routines?.find(r => r.title.toLowerCase().includes(keyword));
          if (found) matched = { id: found.id, title: found.title };
        }

        if (matched) {
          userMetadata.command!.targetId = matched.id;
          userMetadata.command!.title = matched.title;
          await supabase
            .from('chat_messages')
            .update({ metadata: userMetadata as unknown as Record<string, unknown> })
            .eq('id', savedUserMessage.id);

          aiResponse = await generateActionResponse(
            `[สถานะระบบ: user ต้องการลบ${typeName} "${matched.title}" — การลบจะย้อนกลับไม่ได้] — ถาม user ยืนยัน ลงท้ายว่า พิมพ์ "ใช่" หรือ "ไม่"`,
            message,
            conversationHistory
          );
        } else {
          aiResponse = await generateActionResponse(
            `[สถานะระบบ: ไม่พบ${typeName}ที่ชื่อ "${keyword}"] — แจ้ง user สั้นๆ แนะนำให้เช็คชื่อ`,
            message,
            conversationHistory
          );
        }
      } else if (intent.intent === 'clarify') {
        // AI ไม่แน่ใจ → ส่ง choices ให้ user เลือก
        let clarifyMsg = intent.clarifyMessage || 'ไม่แน่ใจว่าต้องการแบบไหนคะ เลือกได้เลย:';
        if (intent.choices && intent.choices.length > 0) {
          clarifyMsg += '\n\n' + intent.choices.map((c, i) => `${i + 1}. ${c}`).join('\n');
        }
        aiResponse = clarifyMsg;
      } else if (isCommand) {
        // === ตรวจซ้ำซ้อน: ถ้ามีรายการเดิมอยู่แล้ว → แจ้ง user ===
        let duplicateWarning = '';
        if (intent.intent === 'create_event' && intent.title && intent.date) {
          const { events } = await getUserEvents();
          const dup = events?.find(e =>
            e.title.toLowerCase().includes((intent.title || '').toLowerCase()) &&
            e.event_date === intent.date
          );
          if (dup) {
            duplicateWarning = ` ⚠️ มีนัด "${dup.title}" วันเดียวกันอยู่แล้ว`;
          }
        } else if (intent.intent === 'create_routine' && intent.title) {
          const { routines } = await getUserRoutines();
          const dup = routines?.find(r =>
            r.title.toLowerCase().includes((intent.title || '').toLowerCase())
          );
          if (dup) {
            duplicateWarning = ` ⚠️ มีกิจวัตร "${dup.title}" อยู่แล้ว`;
          }
        }

        // Create command → ask for confirmation via AI
        const createTypeMap: Record<string, string> = {
          create_event: 'นัดหมาย', create_task: 'งาน', create_note: 'บันทึก',
          create_routine: 'กิจวัตร', create_monthly_routine: 'กิจวัตรรายเดือน',
        };
        const createTypeName = createTypeMap[intent.intent] || 'รายการ';
        const createTitle = intent.title || message.slice(0, 50);
        const detailParts: string[] = [];
        if (intent.date) detailParts.push(`วันที่ ${intent.date}`);
        if (intent.time) detailParts.push(`เวลา ${intent.time} น.`);
        if (intent.description) detailParts.push(`รายละเอียด: ${intent.description}`);
        const detailStr = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';

        aiResponse = await generateActionResponse(
          `[สถานะระบบ: user ต้องการสร้าง${createTypeName} "${createTitle}"${detailStr}${duplicateWarning}] — สรุปสิ่งที่จะสร้างให้ user${duplicateWarning ? ' แจ้งว่ามีรายการคล้ายกันอยู่แล้ว' : ''} แล้วถามยืนยัน ลงท้ายว่า พิมพ์ "ใช่" หรือ "ไม่"`,
          message,
          conversationHistory
        );
      } else if (customQueryResponse) {
        // Query → ส่งข้อมูลดิบให้ AI สรุปเป็นภาษาพูด
        aiResponse = await generateActionResponse(
          `[ข้อมูลจากระบบ:\n${customQueryResponse}] — สรุปข้อมูลนี้ให้ user เป็นภาษาพูดธรรมชาติ ไม่ต้อง copy ทั้งหมด`,
          message,
          conversationHistory
        );
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

        // AI ได้รับ emotion hint ผ่าน system prompt อยู่แล้ว ไม่ต้อง hardcode prefix
      }
    } catch (aiError) {
      console.error('AI generation error:', aiError);
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error('AI error details:', errMsg);

      if (errMsg === 'RATE_LIMIT') {
        aiResponse = 'ตอนนี้คนเยอะ รอแปบนึงแล้วลองใหม่นะ ⏳';
      } else {
        aiResponse = 'อุ๊ย มีปัญหานิดนึง ลองพิมพ์ใหม่อีกทีได้ไหม 🙏';
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
