import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseCommand, isQueryCommand, isDeleteAllCommand, isEditCommand } from '@/lib/ai/keyword-parser';
import { detectSearchNeed } from '@/lib/ai/search-detector';
import { detectUserEmotion } from '@/lib/ai/context-utils';
import { parseThaiDate } from '@/lib/utils/thai-date-parser';

export interface AnalyzedIntent {
  intent: 'create_event' | 'create_task' | 'create_note' | 'create_routine' | 'create_monthly_routine'
    | 'edit_event' | 'edit_task' | 'edit_note' | 'edit_routine' | 'edit_monthly_routine'
    | 'delete_all' | 'delete_event' | 'delete_task' | 'delete_note' | 'delete_routine' | 'delete_monthly_routine'
    | 'query' | 'chat' | 'search' | 'clarify';
  day_of_month?: number;
  clarifyMessage?: string;  // ข้อความถามกลับเมื่อไม่แน่ใจ
  choices?: string[];       // ตัวเลือกให้ user เลือก
  title?: string;
  description?: string;
  date?: string;       // YYYY-MM-DD
  time?: string;       // HH:mm
  priority?: 'high' | 'medium' | 'low';
  searchQuery?: string;
  checklist_items?: { title: string; assignee?: string }[];
  beforeDate?: string; // YYYY-MM-DD — ก่อนวันที่ X
  afterDate?: string;  // YYYY-MM-DD — หลังวันที่ X
  // สำหรับ create_routine
  routine_time?: string;        // HH:mm
  days_of_week?: number[];      // 0=อาทิตย์ ... 6=เสาร์
  remind_before_minutes?: number;
  // สำหรับ delete_all: เงื่อนไขการลบ
  deleteFilter?: {
    date?: string;           // ลบเฉพาะวันที่นี้ (YYYY-MM-DD)
    type?: 'create_event' | 'create_task' | 'create_note'; // ลบเฉพาะประเภทนี้
    titleKeyword?: string;   // ลบเฉพาะรายการที่ชื่อตรงกับ keyword นี้
    all?: boolean;           // ลบทั้งหมดไม่เลือก
  };
  // สำหรับ edit_event: ระบุนัดที่จะแก้ไข
  editTarget?: {
    titleKeyword?: string;   // ชื่อนัดเดิม (keyword)
    date?: string;           // วันที่เดิมของนัด (YYYY-MM-DD)
  };
  raw: string;
}

const INTENT_PROMPT = `คุณคือ AI วิเคราะห์คำสั่งสำหรับแอป "Abduloei" — ผู้ช่วยจัดการชีวิตประจำวัน ตอบเป็น JSON เท่านั้น

วันนี้คือ: {{TODAY}}

=== ระบบของ Abduloei มีฟีเจอร์เหล่านี้ ===

1. "create_event" — สร้างนัดหมาย (ต้องมี: title, ควรมี: date, time, description, location)
   keywords: สร้างนัด, เพิ่มนัด, นัดหมาย, อย่าลืม, ต้องไป, จองคิว

2. "create_task" — สร้างงาน/to-do (ต้องมี: title, ถ้ามี: date, time = deadline)
   keywords: เพิ่มงาน, สร้างงาน, todo, ต้องซื้อ, ต้องจ่าย, ต้องทำ, ต้องไปรับ

3. "create_note" — จดบันทึก (ต้องมี: title + description)
   keywords: จำไว้, บันทึก, จด, โน้ต, เมโม, save

4. "create_routine" — กิจวัตรรายสัปดาห์ (ต้องมี: title, routine_time, days_of_week)
   keywords: ทุกวัน, ทุกเช้า, ทุกคืน, routine, ประจำ, ทุกวันจันทร์
   days_of_week: 0=อา, 1=จ, 2=อ, 3=พ, 4=พฤ, 5=ศ, 6=ส
   "ทุกวัน"=[0,1,2,3,4,5,6], "วันทำงาน"=[1,2,3,4,5], "วันหยุด"=[0,6]

5. "create_monthly_routine" — กิจวัตรรายเดือน (ต้องมี: title, routine_time, day_of_month)
   keywords: ทุกเดือน, รายเดือน, ทุกวันที่, ของเดือน
   day_of_month: 1-31, ใช้ 32 = สิ้นเดือน

6. "edit_event" — แก้ไขนัดหมาย (ต้องมี: editTarget.titleKeyword + สิ่งที่จะแก้)
   keywords: แก้ไขนัด, เปลี่ยนนัด, เลื่อนนัด, อัปเดตนัด

7. "edit_task" — แก้ไขงาน/to-do (ต้องมี: editTarget.titleKeyword + สิ่งที่จะแก้)
   keywords: แก้ไขงาน, เปลี่ยนงาน, อัปเดตงาน

8. "edit_note" — แก้ไขบันทึก (ต้องมี: editTarget.titleKeyword + สิ่งที่จะแก้)
   keywords: แก้ไขบันทึก, แก้โน้ต, อัปเดตบันทึก

9. "edit_routine" — แก้ไขกิจวัตร (ต้องมี: editTarget.titleKeyword + สิ่งที่จะแก้)
   keywords: แก้ไขกิจวัตร, เปลี่ยนกิจวัตร, แก้ routine

10. "edit_monthly_routine" — แก้ไขกิจวัตรรายเดือน (ต้องมี: editTarget.titleKeyword + สิ่งที่จะแก้)
   keywords: แก้ไขกิจวัตรรายเดือน, เปลี่ยนกิจวัตรรายเดือน

11. "delete_event" — ลบนัดหมายเฉพาะรายการ (ต้องมี: editTarget.titleKeyword)
    keywords: ลบนัด, ยกเลิกนัด, cancel นัด, ไม่ไปแล้ว
    ⚠️ ใช้เมื่อลบเจาะจง เช่น "ลบนัดหมอ", "ยกเลิกนัดประชุม"

12. "delete_task" — ลบงานเฉพาะรายการ (ต้องมี: editTarget.titleKeyword)
    keywords: ลบงาน, ยกเลิกงาน

13. "delete_note" — ลบบันทึกเฉพาะรายการ (ต้องมี: editTarget.titleKeyword)
    keywords: ลบบันทึก, ลบโน้ต

14. "delete_routine" — ลบกิจวัตร (ต้องมี: editTarget.titleKeyword)
    keywords: ลบกิจวัตร, ยกเลิกกิจวัตร

15. "delete_monthly_routine" — ลบกิจวัตรรายเดือน (ต้องมี: editTarget.titleKeyword)
    keywords: ลบกิจวัตรรายเดือน

16. "delete_all" — ลบรายการทั้งหมด (ใช้เมื่อลบหมด ไม่เจาะจง)
    keywords: ลบทั้งหมด, เคลียร์, ล้างข้อมูล, ลบหมด

17. "query" — ถามดูรายการ
    keywords: มีนัดไหม, ว่างไหม, ดูนัด, มีงานอะไร, ตาราง

18. "search" — ค้นหาข้อมูลบนอินเทอร์เน็ต
    keywords: ราคา, ข่าว, อากาศ, หุ้น

19. "chat" — แชททั่วไป ทักทาย เล่าเรื่อง ระบาย

20. "clarify" — ไม่แน่ใจว่า user ต้องการอะไร → ส่ง choices ให้เลือก
    ใช้เมื่อ: ข้อความกำกวม, อาจเป็นได้หลาย intent, ข้อมูลไม่ครบ

=== กฎสำคัญ ===
- ถ้าข้อความมี "ทุกเดือน/รายเดือน/ทุกวันที่/ของเดือน" → create_monthly_routine เสมอ (ไม่ใช่ create_routine!)
- ถ้าข้อความมี "ทุกวัน/ทุกเช้า/ทุกคืน/routine" → create_routine เสมอ (ไม่ใช่ create_event!)
- เล่าเรื่องอดีต + อารมณ์ → chat เสมอ
- ถ้าไม่แน่ใจ intent → ใช้ "clarify" พร้อม choices
- ถ้าเป็น command แต่ข้อมูลไม่ครบ → ใช้ "clarify" พร้อมถามข้อมูลที่ขาด
- title ต้องกระชับ ไม่เอาคำสั่ง ("สร้างนัด", "ลบ") มาใส่
- เวลาไทย: "บ่ายโมง"=13:00, "2ทุ่ม"=20:00, "เที่ยง"=12:00, "4ทุ่ม"=22:00
- remind_before_minutes default = 10
- ลบเจาะจง (เช่น "ลบนัดหมอ") → ใช้ delete_event/delete_task/etc. ไม่ใช่ delete_all
- ลบหมดทั้งประเภท (เช่น "ลบนัดทั้งหมด") → ใช้ delete_all + deleteFilter.type
- แก้ไข → editTarget.titleKeyword คือคำที่ใช้หารายการเดิม

=== JSON format ===
{
  "intent": "...",
  "title": "ชื่อสั้นๆ",
  "description": "รายละเอียด",
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "routine_time": "HH:mm",
  "days_of_week": [0,1,2,3,4,5,6],
  "day_of_month": 5,
  "remind_before_minutes": 10,
  "priority": "medium",
  "deleteFilter": {"date":"...", "type":"...", "titleKeyword":"...", "all":true},
  "editTarget": {"date":"...", "titleKeyword":"..."},
  "searchQuery": "...",
  "clarifyMessage": "ข้อความถามกลับ",
  "choices": ["ตัวเลือก 1", "ตัวเลือก 2"]
}

=== ตัวอย่าง (ประโยคเต็ม) ===
"สร้างนัดไปหาหมอพรุ่งนี้ 10 โมง" → {"intent":"create_event","title":"หาหมอ","date":"{{TOMORROW}}","time":"10:00"}
"จ่ายค่าบ้านทุกวันที่ 31 4 ทุ่ม เตือนก่อน 30 นาที" → {"intent":"create_monthly_routine","title":"จ่ายค่าบ้าน","routine_time":"22:00","day_of_month":31,"remind_before_minutes":30}
"จ่ายค่าบ้านสิ้นเดือน 4 ทุ่ม" → {"intent":"create_monthly_routine","title":"จ่ายค่าบ้าน","routine_time":"22:00","day_of_month":32}
"ต้องจ่ายค่าเน็ตทุกสิ้นเดือน" → {"intent":"create_monthly_routine","title":"จ่ายค่าเน็ต","day_of_month":32}
"เตือนทานยาทุกวัน เที่ยง" → {"intent":"create_routine","title":"ทานยา","routine_time":"12:00","days_of_week":[0,1,2,3,4,5,6]}
"ต้องจ่ายค่าเน็ต" → {"intent":"create_task","title":"จ่ายค่าเน็ต"}
"จำไว้ว่ารหัส wifi คือ 12345" → {"intent":"create_note","title":"รหัส wifi","description":"12345"}
"ลบนัดหมายทั้งหมด" → {"intent":"delete_all","deleteFilter":{"all":true,"type":"create_event"}}
"มีนัดอะไรบ้าง" → {"intent":"query"}
"สวัสดี" → {"intent":"chat"}
"จ่ายค่าไฟ" → {"intent":"clarify","clarifyMessage":"ต้องการแบบไหนคะ?","choices":["สร้างงาน (to-do) จ่ายค่าไฟ","สร้างกิจวัตรรายเดือน จ่ายค่าไฟ","สร้างนัดหมาย จ่ายค่าไฟ"]}
"บันทึกรายเดือนจ่ายค่าไฟวันที่ 5 เวลาเที่ยง เตือนก่อน 5 นาที" → {"intent":"create_monthly_routine","title":"จ่ายค่าไฟ","routine_time":"12:00","day_of_month":5,"remind_before_minutes":5}
"แก้ไขนัดหมอเป็นวันศุกร์" → {"intent":"edit_event","editTarget":{"titleKeyword":"หมอ"},"date":"..."}
"แก้ไขงานจ่ายค่าเน็ตเป็นพรุ่งนี้" → {"intent":"edit_task","editTarget":{"titleKeyword":"จ่ายค่าเน็ต"},"date":"{{TOMORROW}}"}
"แก้บันทึกรหัส wifi เป็น 99999" → {"intent":"edit_note","editTarget":{"titleKeyword":"รหัส wifi"},"description":"99999"}
"แก้กิจวัตรทานยาเป็น 2 ทุ่ม" → {"intent":"edit_routine","editTarget":{"titleKeyword":"ทานยา"},"routine_time":"20:00"}
"แก้กิจวัตรรายเดือนจ่ายค่าบ้านเป็นวันที่ 25" → {"intent":"edit_monthly_routine","editTarget":{"titleKeyword":"จ่ายค่าบ้าน"},"day_of_month":25}
"ลบนัดหมอ" → {"intent":"delete_event","editTarget":{"titleKeyword":"หมอ"}}
"ลบงานจ่ายค่าเน็ต" → {"intent":"delete_task","editTarget":{"titleKeyword":"จ่ายค่าเน็ต"}}
"ลบบันทึกรหัส wifi" → {"intent":"delete_note","editTarget":{"titleKeyword":"รหัส wifi"}}
"ลบกิจวัตรทานยา" → {"intent":"delete_routine","editTarget":{"titleKeyword":"ทานยา"}}
"ลบกิจวัตรรายเดือนจ่ายค่าบ้าน" → {"intent":"delete_monthly_routine","editTarget":{"titleKeyword":"จ่ายค่าบ้าน"}}
"ยกเลิกนัดประชุม" → {"intent":"delete_event","editTarget":{"titleKeyword":"ประชุม"}}
"ราคาทองวันนี้" → {"intent":"search","searchQuery":"ราคาทองวันนี้"}
"เหนื่อยมากวันนี้" → {"intent":"chat"}

=== ตัวอย่าง (ภาษาพูดห้วนๆ ไม่เป็นทางการ — สำคัญมาก ต้องเข้าใจด้วย) ===
"หมอพรุ่งนี้ 10 โมง" → {"intent":"create_event","title":"หาหมอ","date":"{{TOMORROW}}","time":"10:00"}
"นัดหมอ" → {"intent":"create_event","title":"หาหมอ"}
"ไปหาหมอ" → {"intent":"create_event","title":"หาหมอ"}
"ประชุม 3 ทุ่ม" → {"intent":"create_event","title":"ประชุม","time":"21:00"}
"กินข้าวกับแม่เที่ยง" → {"intent":"create_event","title":"กินข้าวกับแม่","time":"12:00"}
"พรุ่งนี้สอบ" → {"intent":"create_event","title":"สอบ","date":"{{TOMORROW}}"}
"ซื้อน้ำตาล" → {"intent":"create_task","title":"ซื้อน้ำตาล"}
"ต่อทะเบียน" → {"intent":"create_task","title":"ต่อทะเบียน"}
"ไปรับลูก 4 โมง" → {"intent":"create_task","title":"ไปรับลูก","time":"16:00"}
"อย่าลืมซักผ้า" → {"intent":"create_task","title":"ซักผ้า"}
"จำไว้ เลขบัญชี 1234567890" → {"intent":"create_note","title":"เลขบัญชี","description":"1234567890"}
"pass wifi = hello123" → {"intent":"create_note","title":"รหัส wifi","description":"hello123"}
"กินยาทุกวัน" → {"intent":"create_routine","title":"กินยา","days_of_week":[0,1,2,3,4,5,6]}
"วิ่งทุกเช้า 6 โมง" → {"intent":"create_routine","title":"วิ่ง","routine_time":"06:00","days_of_week":[0,1,2,3,4,5,6]}
"ค่าเน็ตทุกเดือน" → {"intent":"create_monthly_routine","title":"จ่ายค่าเน็ต"}
"ค่าบ้าน สิ้นเดือน" → {"intent":"create_monthly_routine","title":"จ่ายค่าบ้าน","day_of_month":32}
"มีนัดไรบ้าง" → {"intent":"query"}
"ว่างไหมพรุ่งนี้" → {"intent":"query","date":"{{TOMORROW}}"}
"วันนี้ต้องทำไร" → {"intent":"query"}
"ดูงาน" → {"intent":"query"}
"ลบนัดหมอทิ้ง" → {"intent":"delete_event","editTarget":{"titleKeyword":"หมอ"}}
"ไม่ไปหมอแล้ว" → {"intent":"delete_event","editTarget":{"titleKeyword":"หมอ"}}
"เลื่อนนัดหมอเป็นศุกร์" → {"intent":"edit_event","editTarget":{"titleKeyword":"หมอ"},"date":"..."}
"เปลี่ยนเวลาประชุมเป็นบ่าย 3" → {"intent":"edit_event","editTarget":{"titleKeyword":"ประชุม"},"time":"15:00"}
"เบื่อจัง" → {"intent":"chat"}
"555" → {"intent":"chat"}
"ขอบคุณนะ" → {"intent":"chat"}
"ทำไรดี" → {"intent":"chat"}
"วันนี้เจอเพื่อนเก่ามา ดีใจมาก" → {"intent":"chat"}

=== กฎพิเศษสำหรับข้อความสั้น/ไม่ชัด ===
- ถ้าเห็นคำว่า "หมอ", "ทันต", "สอบ", "ประชุม", "สัมภาษณ์" + เวลา/วัน → create_event เลย ไม่ต้อง clarify
- ถ้าเห็น "ซื้อ", "รับ", "ส่ง", "ต่อ" + สิ่งของ → create_task เลย
- ถ้าเห็น "จำไว้", "pass", "รหัส", "เลขที่" → create_note เลย
- ถ้าเห็น "ไม่ไป...แล้ว", "ยกเลิก", "เลิก" + keyword → delete เลย
- ถ้าสั้นมาก (1-2 คำ) แต่ไม่มี keyword ชัด → ใช้ clarify ดีกว่าเดา

ตอบเฉพาะ JSON เท่านั้น ห้ามมี text อื่น`;

/**
 * ใช้ Gemini วิเคราะห์ intent ของข้อความ
 * ฉลาดกว่า keyword parser เพราะเข้าใจ context
 */
export async function analyzeIntent(message: string): Promise<AnalyzedIntent> {
  try {
    // คำนวณวันที่ต่างๆ สำหรับ context
    const today = new Date();
    const todayStr = formatDate(today);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);

    const nextFriday = new Date(today);
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    const nextFridayStr = formatDate(nextFriday);

    const prompt = INTENT_PROMPT
      .replace('{{TODAY}}', todayStr)
      .replaceAll('{{TOMORROW}}', tomorrowStr)
      .replace('{{NEXT_FRIDAY}}', nextFridayStr);

    let response: string;

    // ใช้ Groq เป็นหลัก
    if (process.env.GROQ_API_KEY) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: message },
          ],
          max_tokens: 500,
          temperature: 0.1,
        }),
      });

      if (!res.ok) throw new Error(`Groq error ${res.status}`);
      const data = await res.json();
      response = data.choices?.[0]?.message?.content?.trim() || '';
    } else if (process.env.GEMINI_API_KEY) {
      // Fallback: Gemini
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      });
      const result = await model.generateContent(`${prompt}\n\nข้อความ: "${message}"`);
      response = result.response.text().trim();
    } else {
      throw new Error('No AI API key configured');
    }

    // Parse JSON จาก response (อาจมี markdown code block)
    const jsonStr = response.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(jsonStr);

    let intent = parsed.intent || 'chat';

    // Safety net: ถ้า Gemini ตอบ intent ที่ไม่ตรงกับ keyword ชัดเจน → override
    if (intent !== 'query' && isQueryCommand(message)) {
      intent = 'query';
    } else if (intent !== 'delete_all' && isDeleteAllCommand(message)) {
      intent = 'delete_all';
    } else if (intent !== 'edit_event' && isEditCommand(message)) {
      intent = 'edit_event';
    }

    return {
      intent,
      title: parsed.title,
      description: parsed.description,
      date: parsed.date,
      time: parsed.time,
      priority: parsed.priority,
      searchQuery: parsed.searchQuery,
      checklist_items: parsed.checklist_items,
      beforeDate: parsed.beforeDate,
      afterDate: parsed.afterDate,
      deleteFilter: parsed.deleteFilter,
      editTarget: parsed.editTarget,
      routine_time: parsed.routine_time,
      days_of_week: parsed.days_of_week,
      remind_before_minutes: parsed.remind_before_minutes,
      day_of_month: parsed.day_of_month,
      clarifyMessage: parsed.clarifyMessage,
      choices: parsed.choices,
      raw: message,
    };
  } catch (error) {
    console.error('Intent analysis error:', error);
    // Fallback: ถ้า AI วิเคราะห์ไม่ได้ → ใช้ keyword parser แทน
    return keywordFallback(message);
  }
}

/**
 * Fallback: ใช้ keyword parser เมื่อ AI ไม่พร้อม (rate limit, error, etc.)
 */
function keywordFallback(message: string): AnalyzedIntent {
  // ตรวจ emotion ก่อน
  const { emotion } = detectUserEmotion(message);
  const isEmotional = emotion !== 'neutral';

  // ตรวจ search
  const searchIntent = detectSearchNeed(message);
  if (searchIntent.needsSearch) {
    return { intent: 'search', searchQuery: searchIntent.query, raw: message };
  }

  // ถ้า emotional → chat
  if (isEmotional) {
    return { intent: 'chat', raw: message };
  }

  // ตรวจ query ก่อน delete/command (เพราะ "มีนัดอะไรบ้างวันที่ 27" มีคำว่า "นัด" + datetime ที่ command จะจับผิด)
  if (isQueryCommand(message)) {
    return { intent: 'query', raw: message };
  }

  // ตรวจ delete — parse filter จากข้อความ
  if (isDeleteAllCommand(message)) {
    const parsedDate = parseThaiDate(message);
    const hasDate = !!parsedDate.date;
    const isEventDelete = /นัด|หมาย|event/.test(message.toLowerCase());
    const isTaskDelete = /งาน|task|todo/.test(message.toLowerCase());
    const isNoteDelete = /บันทึก|โน้ต|note|เมโม/.test(message.toLowerCase());

    const filter: AnalyzedIntent['deleteFilter'] = {};

    if (hasDate) {
      filter.date = parsedDate.date;
    }
    if (isEventDelete && !isTaskDelete && !isNoteDelete) {
      filter.type = 'create_event';
    } else if (isTaskDelete && !isEventDelete && !isNoteDelete) {
      filter.type = 'create_task';
    } else if (isNoteDelete && !isEventDelete && !isTaskDelete) {
      filter.type = 'create_note';
    }
    if (!hasDate && !filter.type) {
      filter.all = true;
    }

    return { intent: 'delete_all', deleteFilter: filter, raw: message };
  }

  // ตรวจ command
  const parsed = parseCommand(message);
  if (parsed) {
    return {
      intent: parsed.type,
      title: parsed.title,
      description: parsed.description,
      date: parsed.date,
      time: parsed.time,
      priority: parsed.priority,
      checklist_items: parsed.checklist_items,
      raw: message,
    };
  }

  return { intent: 'chat', raw: message };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
