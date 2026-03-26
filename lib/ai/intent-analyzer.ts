import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseCommand, isQueryCommand, isDeleteAllCommand, isEditCommand } from '@/lib/ai/keyword-parser';
import { detectSearchNeed } from '@/lib/ai/search-detector';
import { detectUserEmotion } from '@/lib/ai/context-utils';
import { parseThaiDate } from '@/lib/utils/thai-date-parser';

export interface AnalyzedIntent {
  intent: 'create_event' | 'create_task' | 'create_note' | 'create_routine' | 'delete_all' | 'edit_event' | 'query' | 'chat' | 'search';
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

const INTENT_PROMPT = `คุณคือ AI ที่วิเคราะห์ intent ของข้อความภาษาไทย ตอบเป็น JSON เท่านั้น ห้ามตอบอย่างอื่น

วันนี้คือ: {{TODAY}}

ประเภท intent:
- "create_event": สร้างนัดหมาย/กิจกรรม — ต้องมีเจตนาชัดเจน เช่น สร้างนัด, เพิ่มนัด, อย่าลืม, ต้องไป, นัดหมาย, จองคิว, นัดให้, set นัด, เตือนว่าต้อง
- "create_task": สร้างงาน/to-do — ไม่มีวัน/เวลาชัดเจน เช่น ต้องซื้อ, จ่ายค่า, โทรหา, ส่งงาน, เพิ่มงาน, todo
- "create_note": จดบันทึก — เช่น จำไว้, บันทึก, จดโน้ต, เมโม, save ว่า, จำด้วย, จดหน่อย
- "create_routine": สร้างกิจวัตรประจำวัน/สัปดาห์ — ทำซ้ำเป็นประจำ เช่น ทานยาทุกวัน, ออกกำลังกายทุกเช้า, ให้อาหารแมวทุกวัน, เตือนทุกวัน, ประจำ, routine
- "edit_event": แก้ไข/เปลี่ยนแปลงนัดหมายที่มีอยู่ เช่น แก้ไขนัด, เปลี่ยนนัด, อัปเดตนัด, เลื่อนนัด
- "delete_all": ลบรายการ — ลบทั้งหมดหรือบางส่วน เช่น ลบนัด, ยกเลิกนัด, cancel, ไม่ไปแล้ว, เคลียร์
- "query": ถามรายการ — เช่น มีนัดอะไรบ้าง, ดูนัด, ตารางวัน, ว่างไหม, เช็คนัด, to-do ที่ยังไม่เสร็จ, มีงานค้างอะไร
- "search": ค้นหาข้อมูล — ราคา, ข่าว, สภาพอากาศ, ผลบอล, หุ้น, ทอง
- "chat": สนทนาทั่วไป ทักทาย ระบายอารมณ์ เล่าเรื่องที่เกิดขึ้นแล้ว

กฎสำคัญ:
1. เล่าเรื่องที่เกิดแล้ว + มีอารมณ์ → "chat" เสมอ แม้จะมีวัน/เวลา
2. "วันนี้" + เล่าเรื่อง ≠ create_event
3. "ลบ/ยกเลิก/cancel/ไม่ไปแล้ว" + ชื่อนัดหรือวัน → "delete_all" เสมอ
4. "มีนัดไหม/ว่างไหม/ตารางวัน/ดูนัด" → "query" เสมอ
5. ถ้ามี "สร้างนัด/นัดให้/เพิ่มนัด" → create_event เสมอ
6. "แก้ไข/เปลี่ยน/อัปเดต/เลื่อน" + นัดที่มีอยู่ → "edit_event" เสมอ (ไม่ใช่ create_event!)
7. "ทุกวัน/ทุกเช้า/ทุกคืน/ประจำ/routine/ทุก จ./ทุกสัปดาห์" → "create_routine" เสมอ (ไม่ใช่ create_event!)
   - days_of_week: 0=อาทิตย์, 1=จันทร์, 2=อังคาร, 3=พุธ, 4=พฤหัส, 5=ศุกร์, 6=เสาร์
   - "ทุกวัน" = [0,1,2,3,4,5,6]
   - "วันจันทร์ พุธ ศุกร์" = [1,3,5]
   - "วันธรรมดา/วันทำงาน" = [1,2,3,4,5]
   - "วันหยุด/เสาร์อาทิตย์" = [0,6]
   - routine_time = เวลาที่ต้องทำ (HH:mm)
   - remind_before_minutes = เตือนก่อนกี่นาที (default 10)
   - "editTarget" = นัดเดิมที่จะแก้ (date = วันที่เดิม, titleKeyword = ชื่อเดิม)
   - "date" = วันที่ใหม่ที่ต้องการเปลี่ยนไป
   - "title" = ชื่อใหม่ (ถ้าเปลี่ยน)
   - "time" = เวลาใหม่ (ถ้าเปลี่ยน)

ตอบ JSON format:
{
  "intent": "create_event",
  "title": "ชื่อสั้นๆ",
  "description": "รายละเอียด (ถ้ามี)",
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "priority": "medium",
  "checklist_items": [{"title": "รายการ 1"}],
  "deleteFilter": {"date": "YYYY-MM-DD", "type": "create_event", "titleKeyword": "keyword", "all": true},
  "editTarget": {"date": "YYYY-MM-DD (วันที่เดิมของนัดที่จะแก้)", "titleKeyword": "ชื่อเดิมของนัด"},
  "beforeDate": "YYYY-MM-DD (ใช้เมื่อถาม 'ก่อนวันที่ X')",
  "afterDate": "YYYY-MM-DD (ใช้เมื่อถาม 'หลังวันที่ X')"
}

=== ตัวอย่าง create_event (สร้างนัด) ===
- "สร้างนัดวันศุกร์หน้าไปงานแต่งงาน" → {"intent":"create_event","title":"งานแต่งงาน","date":"{{NEXT_FRIDAY}}"}
- "นัดหมอฟันวันที่ 25/4 บ่าย 2" → {"intent":"create_event","title":"หมอฟัน","date":"2026-04-25","time":"14:00"}
- "อย่าลืมไปประชุมพรุ่งนี้ 10 โมง" → {"intent":"create_event","title":"ประชุม","date":"{{TOMORROW}}","time":"10:00"}
- "จองคิวหมอวันที่ 5 เมษา บ่ายโมง" → {"intent":"create_event","title":"หมอ","date":"2026-04-05","time":"13:00"}
- "นัดกินข้าววันเสาร์เที่ยง" → {"intent":"create_event","title":"กินข้าว","date":"...","time":"12:00"}
- "เพิ่มนัดกินข้าวกับพี่แจ้ วันเสาร์เที่ยง" → {"intent":"create_event","title":"กินข้าวกับพี่แจ้","date":"...","time":"12:00"}
- "มีนัดสัมภาษณ์งาน จ. หน้า บ่ายโมง" → {"intent":"create_event","title":"สัมภาษณ์งาน","date":"...","time":"13:00"}
- "ตั้งนัดไปฟิตเนส วันนี้ 5 โมงเย็น" → {"intent":"create_event","title":"ฟิตเนส","date":"{{TODAY}}","time":"17:00"}
- "สร้างนัดวันพุธหน้าไปดูหนังกับพี่ดุ๊กช่วง 3 ทุ่ม" → {"intent":"create_event","title":"ดูหนังกับพี่ดุ๊ก","date":"...","time":"21:00"}
- "ต้องไปหาหมอวันศุกร์ตอนบ่าย 2 ครึ่ง" → {"intent":"create_event","title":"หาหมอ","date":"...","time":"14:30"}
- "set นัด meeting วัน Friday 2 pm" → {"intent":"create_event","title":"meeting","date":"...","time":"14:00"}

=== ตัวอย่าง create_task (สร้างงาน) ===
- "ต้องซื้อนมกับไข่ไก่" → {"intent":"create_task","title":"ซื้อนมกับไข่ไก่"}
- "จ่ายค่าไฟ" → {"intent":"create_task","title":"จ่ายค่าไฟ"}
- "โทรหาช่างแอร์" → {"intent":"create_task","title":"โทรหาช่างแอร์"}
- "ส่งรายงานให้หัวหน้า" → {"intent":"create_task","title":"ส่งรายงานให้หัวหน้า"}
- "todo ซื้อนมกลับบ้าน" → {"intent":"create_task","title":"ซื้อนมกลับบ้าน"}
- "เพิ่มงาน ส่งรายงานภายในวันศุกร์" → {"intent":"create_task","title":"ส่งรายงาน","date":"..."}
- "มีงานต้องทำ เตรียมสไลด์พรีเซนต์" → {"intent":"create_task","title":"เตรียมสไลด์พรีเซนต์"}
- "ไปรับพัสดุที่ไปรษณีย์" → {"intent":"create_task","title":"รับพัสดุที่ไปรษณีย์"}

=== ตัวอย่าง create_note (จดบันทึก) ===
- "จำไว้ว่ารหัส wifi คือ hello1234" → {"intent":"create_note","title":"รหัส wifi","description":"hello1234"}
- "บันทึกเบอร์ช่างไฟ 081-xxx-xxxx" → {"intent":"create_note","title":"เบอร์ช่างไฟ","description":"081-xxx-xxxx"}
- "จดไว้ว่าขนาดรองเท้าลูก 28" → {"intent":"create_note","title":"ขนาดรองเท้าลูก","description":"28"}
- "เมโม เลขที่ออเดอร์ 12345" → {"intent":"create_note","title":"เลขที่ออเดอร์","description":"12345"}
- "save ว่า password คือ abc123" → {"intent":"create_note","title":"password","description":"abc123"}
- "จำด้วย ที่จอดรถชั้น 3 โซน B" → {"intent":"create_note","title":"ที่จอดรถ","description":"ชั้น 3 โซน B"}
- "โน้ต สิ่งที่คุยกับลูกค้าวันนี้ เรื่องราคาใหม่" → {"intent":"create_note","title":"คุยกับลูกค้า","description":"เรื่องราคาใหม่"}
- "ไว้ว่ารหัส wifi คือ 678" → {"intent":"create_note","title":"รหัส wifi","description":"678"}

=== ตัวอย่าง edit_event (แก้ไขนัด) ===
- "แก้ไขนัดวันที่ 24 มีนาคม เปลี่ยนไปดูหนังกับน้องแอมวันที่ 25" → {"intent":"edit_event","editTarget":{"date":"2026-03-24"},"title":"ดูหนังกับน้องแอม","date":"2026-03-25"}
- "เปลี่ยนนัดหมอฟันเป็นดูหนังกับน้องแอม" → {"intent":"edit_event","editTarget":{"titleKeyword":"หมอฟัน"},"title":"ดูหนังกับน้องแอม"}
- "เลื่อนนัดวันที่ 20 ไปวันที่ 22" → {"intent":"edit_event","editTarget":{"date":"2026-03-20"},"date":"2026-03-22"}
- "แก้ไขนัดประชุมวันจันทร์เป็นวันอังคาร" → {"intent":"edit_event","editTarget":{"titleKeyword":"ประชุม"},"date":"..."}
- "อัปเดตนัดกินข้าววันที่ 25 เปลี่ยนเวลาเป็นบ่าย 3" → {"intent":"edit_event","editTarget":{"titleKeyword":"กินข้าว","date":"2026-03-25"},"time":"15:00"}
- "เลื่อนนัดหมอฟันวันที่ 24 ไปวันที่ 26 บ่ายโมง" → {"intent":"edit_event","editTarget":{"titleKeyword":"หมอฟัน","date":"2026-03-24"},"date":"2026-03-26","time":"13:00"}

=== ตัวอย่าง delete_all (ลบ) ===
- "ลบนัดหมายทั้งหมด" → {"intent":"delete_all","deleteFilter":{"all":true}}
- "ลบนัดหมายวันที่ 27/3 ทั้งหมด" → {"intent":"delete_all","deleteFilter":{"date":"2026-03-27","type":"create_event"}}
- "ลบงานทั้งหมด" → {"intent":"delete_all","deleteFilter":{"type":"create_task","all":true}}
- "ลบบันทึกทั้งหมด" → {"intent":"delete_all","deleteFilter":{"type":"create_note","all":true}}
- "เคลียร์ทุกอย่าง" → {"intent":"delete_all","deleteFilter":{"all":true}}
- "ลบนัดงานแต่งงาน" → {"intent":"delete_all","deleteFilter":{"titleKeyword":"งานแต่งงาน"}}
- "ลบนัดหมอฟัน" → {"intent":"delete_all","deleteFilter":{"titleKeyword":"หมอฟัน","type":"create_event"}}
- "ลบนัดประชุมวันที่ 20/3" → {"intent":"delete_all","deleteFilter":{"titleKeyword":"ประชุม","date":"2026-03-20"}}
- "ลบบันทึกรหัส wifi" → {"intent":"delete_all","deleteFilter":{"titleKeyword":"wifi","type":"create_note"}}
- "ยกเลิกนัดประชุมวันศุกร์" → {"intent":"delete_all","deleteFilter":{"titleKeyword":"ประชุม","date":"..."}}
- "cancel นัดพรุ่งนี้" → {"intent":"delete_all","deleteFilter":{"date":"{{TOMORROW}}"}}
- "ไม่ไปนัดวันพุธแล้ว" → {"intent":"delete_all","deleteFilter":{"date":"..."}}
- "ไม่ไปหมอแล้ว" → {"intent":"delete_all","deleteFilter":{"titleKeyword":"หมอ"}}
- "ลบรายการซื้อของ" → {"intent":"delete_all","deleteFilter":{"titleKeyword":"ซื้อของ"}}

=== ตัวอย่าง query (ถามรายการ) ===
- "มีนัดอะไรบ้าง" → {"intent":"query"}
- "มีนัดอะไรบ้างพรุ่งนี้" → {"intent":"query","date":"{{TOMORROW}}"}
- "มีนัดอะไรบ้างวันที่ 27 เดือน 3" → {"intent":"query","date":"2026-03-27"}
- "วันนี้มีอะไรบ้าง" → {"intent":"query","date":"{{TODAY}}"}
- "ดูนัดวันจันทร์" → {"intent":"query","date":"..."}
- "พรุ่งนี้ว่างไหม" → {"intent":"query","date":"{{TOMORROW}}"}
- "ตารางวันพรุ่งนี้เป็นยังไง" → {"intent":"query","date":"{{TOMORROW}}"}
- "เช็คนัดวันที่ 15" → {"intent":"query","date":"..."}
- "มีงานค้างอะไรบ้าง" → {"intent":"query"}
- "to-do ที่ยังไม่เสร็จ" → {"intent":"query"}
- "อาทิตย์หน้ามีนัดไหม" → {"intent":"query"}
- "พรุ่งว่างมะ" → {"intent":"query","date":"{{TOMORROW}}"}
- "มีนัดมั้ย" → {"intent":"query"}
- "ก่อนวันที่ 20 มีนัดไหม" → {"intent":"query","beforeDate":"2026-03-20"}
- "หลังวันที่ 25 มีอะไรบ้าง" → {"intent":"query","afterDate":"2026-03-25"}
- "มีนัดก่อนหน้านี้ไหม ก่อนวันที่ 20" → {"intent":"query","beforeDate":"2026-03-20"}

=== ตัวอย่าง create_routine (กิจวัตร) ===
- "เตือนทานยาทุกวัน 12:00" → {"intent":"create_routine","title":"ทานยา","routine_time":"12:00","days_of_week":[0,1,2,3,4,5,6],"remind_before_minutes":10}
- "ออกกำลังกาย 6 โมงเช้าทุกวัน" → {"intent":"create_routine","title":"ออกกำลังกาย","routine_time":"06:00","days_of_week":[0,1,2,3,4,5,6]}
- "ให้อาหารแมวทุกเช้า 7 โมง เตือนก่อน 15 นาที" → {"intent":"create_routine","title":"ให้อาหารแมว","routine_time":"07:00","days_of_week":[0,1,2,3,4,5,6],"remind_before_minutes":15}
- "เตือนออกกำลังกายทุกวันจันทร์ พุธ ศุกร์ ตอน 5 โมงเย็น" → {"intent":"create_routine","title":"ออกกำลังกาย","routine_time":"17:00","days_of_week":[1,3,5]}
- "routine ทานวิตามิน ทุกเช้า 8 โมง" → {"intent":"create_routine","title":"ทานวิตามิน","routine_time":"08:00","days_of_week":[0,1,2,3,4,5,6]}
- "เตือนรดน้ำต้นไม้ทุกวัน เย็น 5 โมง" → {"intent":"create_routine","title":"รดน้ำต้นไม้","routine_time":"17:00","days_of_week":[0,1,2,3,4,5,6]}
- "ต้องทานยาลดความดันทุกวัน ตอนเที่ยง" → {"intent":"create_routine","title":"ทานยาลดความดัน","routine_time":"12:00","days_of_week":[0,1,2,3,4,5,6]}
- "ล้างจานทุกคืน 2 ทุ่ม" → {"intent":"create_routine","title":"ล้างจาน","routine_time":"20:00","days_of_week":[0,1,2,3,4,5,6]}
- "เตือนประชุมทีมทุกวันจันทร์ 10 โมง" → {"intent":"create_routine","title":"ประชุมทีม","routine_time":"10:00","days_of_week":[1]}
- "พาหมาเดินเล่นทุกเช้าเย็น 6 โมง" → {"intent":"create_routine","title":"พาหมาเดินเล่น","routine_time":"06:00","days_of_week":[0,1,2,3,4,5,6]}
- "ฝึกภาษาอังกฤษวันทำงาน 8 โมง" → {"intent":"create_routine","title":"ฝึกภาษาอังกฤษ","routine_time":"08:00","days_of_week":[1,2,3,4,5]}

=== ตัวอย่าง search (ค้นหา) ===
- "ราคาทองวันนี้" → {"intent":"search","searchQuery":"ราคาทองวันนี้"}
- "อากาศพรุ่งนี้" → {"intent":"search","searchQuery":"สภาพอากาศพรุ่งนี้"}

=== ตัวอย่าง chat (สนทนา) ===
- "สวัสดี สบายดีไหม" → {"intent":"chat"}
- "เครียดมากเลย งานเยอะไม่รู้จะจัดการยังไงดี" → {"intent":"chat"}
- "น้องซีเกมส์หล่อมากวันนี้เจอที่ห้าง" → {"intent":"chat"} (เล่าเรื่อง)
- "วันนี้ไปเดินห้างมา เหนื่อยมาก" → {"intent":"chat"} (เล่าเรื่อง)

สำคัญ:
- title ต้องกระชับ ไม่เอาคำว่า "สร้างนัด", "ให้หน่อย", "ลบ" มาใส่ใน title
- ถ้ามีวัน/เวลาให้คำนวณวันที่จริงจากวันนี้
- ตอบเฉพาะ JSON เท่านั้น ห้ามมี text อื่น`;

/**
 * ใช้ Gemini วิเคราะห์ intent ของข้อความ
 * ฉลาดกว่า keyword parser เพราะเข้าใจ context
 */
export async function analyzeIntent(message: string): Promise<AnalyzedIntent> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1, // ต่ำเพื่อให้ตอบตรง
        maxOutputTokens: 500,
      },
    });

    // คำนวณวันที่ต่างๆ สำหรับ context
    const today = new Date();
    const todayStr = formatDate(today);

    // หาพรุ่งนี้
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);

    // หาวันศุกร์หน้า
    const nextFriday = new Date(today);
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    const nextFridayStr = formatDate(nextFriday);

    const prompt = INTENT_PROMPT
      .replace('{{TODAY}}', todayStr)
      .replaceAll('{{TOMORROW}}', tomorrowStr)
      .replace('{{NEXT_FRIDAY}}', nextFridayStr);

    const result = await model.generateContent(`${prompt}\n\nข้อความ: "${message}"`);
    const response = result.response.text().trim();

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
