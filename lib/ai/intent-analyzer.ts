import { GoogleGenerativeAI } from '@google/generative-ai';

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
  assigned_to?: string;  // ชื่อสมาชิกที่จะ assign เช่น "พี่แดง", "แม่"
  raw: string;
}

const INTENT_PROMPT = `คุณคือ AI วิเคราะห์คำสั่งสำหรับแอป "Abduloei" — ผู้ช่วยจัดการชีวิตประจำวัน ตอบเป็น JSON เท่านั้น

วันนี้คือ: {{TODAY}}

=== ระบบของ Abduloei มีฟีเจอร์เหล่านี้ ===

1. "create_event" — สร้างนัดหมาย (ต้องมี: title, ควรมี: date, time, description, location)
   keywords: สร้างนัด, เพิ่มนัด, นัดหมาย, อย่าลืม, ต้องไป, จองคิว

2. "create_task" — สร้างงาน/to-do (ต้องมี: title, ถ้ามี: date, time = deadline)
   keywords: เพิ่มงาน, สร้างงาน, todo, ต้องซื้อ, ต้องจ่าย, ต้องทำ, ต้องไปรับ, ต้องโอน, โอนเงิน
   ⚠️ ถ้าไม่มีคำว่า "ทุกเดือน/ทุกวัน/ทุกสัปดาห์" → เป็น task ครั้งเดียว ไม่ใช่ routine

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

=== กฎ assigned_to (มอบหมายให้สมาชิก) ===
- ถ้าข้อความระบุชื่อคน เช่น "ให้พี่แดง", "ของแม่", "เตือนน้อง", "บอกพ่อ" → ใส่ assigned_to เป็นชื่อคนนั้น
- ชื่อที่จับได้ควรเป็นชื่อเดี่ยว เช่น "พี่แดง", "แม่", "น้องเอ" (ไม่ใส่คำนำหน้า "ให้", "ของ")
- ถ้าไม่ได้ระบุชื่อใคร → ไม่ต้องใส่ assigned_to

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
  "assigned_to": "ชื่อสมาชิก",
  "clarifyMessage": "ข้อความถามกลับ",
  "choices": ["ตัวเลือก 1", "ตัวเลือก 2"]
}

=== ตัวอย่าง (ประโยคเต็ม) ===
"สร้างนัดไปหาหมอพรุ่งนี้ 10 โมง" → {"intent":"create_event","title":"หาหมอ","date":"{{TOMORROW}}","time":"10:00"}
"สร้างนัดให้พี่แดงไปหาหมอพรุ่งนี้ 10 โมง" → {"intent":"create_event","title":"หาหมอ","date":"{{TOMORROW}}","time":"10:00","assigned_to":"พี่แดง"}
"เตือนแม่จ่ายค่าไฟวันที่ 5 ทุกเดือน" → {"intent":"create_monthly_routine","title":"จ่ายค่าไฟ","day_of_month":5,"assigned_to":"แม่"}
"บอกน้องเอซื้อนม" → {"intent":"create_task","title":"ซื้อนม","assigned_to":"น้องเอ"}
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
"นัดหมอ" → {"intent":"clarify","clarifyMessage":"เข้าใจว่าอยากนัดหมอ วันไหน กี่โมงคะ?","choices":[]}
"ไปหาหมอ" → {"intent":"clarify","clarifyMessage":"อยากไปหาหมอวันไหน กี่โมงคะ?","choices":[]}
"ประชุม 3 ทุ่ม" → {"intent":"clarify","clarifyMessage":"ประชุม 3 ทุ่ม วันไหนคะ?","choices":[]}
"กินข้าวกับแม่เที่ยง" → {"intent":"clarify","clarifyMessage":"กินข้าวกับแม่เที่ยง วันไหนคะ?","choices":[]}
"พรุ่งนี้สอบ" → {"intent":"clarify","clarifyMessage":"สอบพรุ่งนี้กี่โมงคะ?","choices":[]}
"ซื้อน้ำตาล" → {"intent":"create_task","title":"ซื้อน้ำตาล"}
"ต่อทะเบียน" → {"intent":"create_task","title":"ต่อทะเบียน"}
"ไปรับลูก 4 โมง" → {"intent":"create_task","title":"ไปรับลูก","time":"16:00"}
"อย่าลืมซักผ้า" → {"intent":"create_task","title":"ซักผ้า"}
"ต้องโอนเงินให้แม่" → {"intent":"create_task","title":"โอนเงินให้แม่"}
"โอนค่าเช่า" → {"intent":"create_task","title":"โอนค่าเช่า"}
"จำไว้ เลขบัญชี 1234567890" → {"intent":"create_note","title":"เลขบัญชี","description":"1234567890"}
"pass wifi = hello123" → {"intent":"create_note","title":"รหัส wifi","description":"hello123"}
"กินยาทุกวัน" → {"intent":"clarify","clarifyMessage":"กินยาทุกวัน กี่โมงคะ?","choices":[]}
"วิ่งทุกเช้า 6 โมง" → {"intent":"create_routine","title":"วิ่ง","routine_time":"06:00","days_of_week":[0,1,2,3,4,5,6]}
"ค่าเน็ตทุกเดือน" → {"intent":"clarify","clarifyMessage":"จ่ายค่าเน็ตทุกวันที่เท่าไหร่ของเดือนคะ?","choices":[]}
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
- ถ้าเห็นคำว่า "หมอ", "ทันต", "สอบ", "ประชุม", "สัมภาษณ์" + มีทั้งเวลาและวัน → create_event เลย
- ถ้าเห็น "ซื้อ", "รับ", "ส่ง", "ต่อ" + สิ่งของ → create_task เลย (task ไม่จำเป็นต้องมี date/time)
- ถ้าเห็น "จำไว้", "pass", "รหัส", "เลขที่" → create_note เลย
- ถ้าเห็น "ไม่ไป...แล้ว", "ยกเลิก", "เลิก" + keyword → delete เลย
- ถ้าสั้นมาก (1-2 คำ) แต่ไม่มี keyword ชัด → ใช้ clarify ดีกว่าเดา

=== กฎสำคัญมาก: ข้อมูลไม่ครบ → ต้อง clarify ===
แต่ละ intent มีข้อมูล "จำเป็น" ที่ต้องมี ถ้าขาดข้อมูลจำเป็น → ใช้ intent "clarify" แล้วถามข้อมูลที่ขาด

- create_event: ต้องมี title + date + time (ถ้าขาด date หรือ time → clarify ถามว่าวันไหน/กี่โมง)
  เช่น "นัดหมอ" → clarify "อยากนัดหมอวันไหน กี่โมงคะ?"
  เช่น "นัดหมอพรุ่งนี้" → clarify "นัดหมอพรุ่งนี้กี่โมงคะ?"
  เช่น "นัดหมอ 10 โมง" → clarify "นัดหมอ 10 โมง วันไหนคะ?"
  ✅ "นัดหมอพรุ่งนี้ 10 โมง" → create_event (ครบ)

- create_routine: ต้องมี title + routine_time (ถ้าขาด routine_time → clarify ถามเวลา)
  เช่น "กินยาทุกวัน" → clarify "กินยาทุกวัน กี่โมงคะ?"
  ✅ "กินยาทุกวัน เที่ยง" → create_routine (ครบ)

- create_monthly_routine: ต้องมี title + day_of_month (routine_time ไม่มีได้ default 09:00)
  เช่น "จ่ายค่าเน็ตทุกเดือน" → clarify "จ่ายค่าเน็ตทุกวันที่เท่าไหร่ของเดือนคะ?"
  ✅ "จ่ายค่าเน็ตทุกสิ้นเดือน" → create_monthly_routine (ครบ)

- create_task: title เพียงพอ (date/time เป็น optional deadline)
- create_note: title + description เพียงพอ

⚠️ ห้ามเดาข้อมูลที่ user ไม่ได้บอก — ถ้าไม่รู้วันที่/เวลา ต้องถามเสมอ
⚠️ ห้ามใส่ date/time/routine_time/day_of_month ใน JSON ถ้า user ไม่ได้พูดถึงเลย — ปล่อยเป็น null/ไม่ใส่
⚠️ ห้ามเดาว่า "วันนี้" ถ้า user ไม่ได้พูดว่า "วันนี้" — เช่น "นัดหมอ" ไม่ได้หมายความว่าวันนี้
⚠️ เมื่อ clarify ให้บอก user ด้วยว่าเข้าใจอะไรแล้ว เช่น "เข้าใจว่าอยากนัดหมอ แต่ขอทราบวันที่และเวลาด้วยนะคะ"

=== กฎเรื่อง intent ไม่ชัด ===
ถ้าข้อความอาจเป็นได้หลาย intent → ใช้ clarify พร้อม choices
เช่น "จ่ายค่าไฟ" → อาจเป็น task (ครั้งเดียว) หรือ monthly_routine (ทุกเดือน) → clarify

=== ตัวอย่าง clarify follow-up (user ตอบข้อมูลเพิ่ม หลังระบบถามกลับ) ===
ข้อความที่จะส่งมาจะเป็น "ข้อความเดิม + คำตอบใหม่" รวมกัน เช่น:
"นัดหมอ พรุ่งนี้ 10 โมง" → {"intent":"create_event","title":"หาหมอ","date":"{{TOMORROW}}","time":"10:00"}
"ประชุม 3 ทุ่ม วันศุกร์" → {"intent":"create_event","title":"ประชุม","date":"...","time":"21:00"}
"กินยาทุกวัน 8 โมงเช้า" → {"intent":"create_routine","title":"กินยา","routine_time":"08:00","days_of_week":[0,1,2,3,4,5,6]}
"ค่าเน็ตทุกเดือน วันที่ 25" → {"intent":"create_monthly_routine","title":"จ่ายค่าเน็ต","day_of_month":25}
"พรุ่งนี้สอบ 9 โมง" → {"intent":"create_event","title":"สอบ","date":"{{TOMORROW}}","time":"09:00"}

=== สรุปวิธีสั่งทุกฟีเจอร์ (ตัวอย่างที่ครบสมบูรณ์) ===

📌 สร้างนัดหมาย (create_event) — ต้องมี: ชื่อ + วัน + เวลา
  ✅ "นัดหมอพรุ่งนี้ 10 โมง"
  ✅ "ประชุมวันศุกร์บ่าย 3"
  ✅ "สัมภาษณ์งานวันที่ 15 เมษา 9 โมงเช้า"
  ✅ "ไปหาหมอฟัน 20 เมษา บ่ายโมง"
  ❌ "นัดหมอ" → clarify ถามวันและเวลา
  ❌ "ประชุมพรุ่งนี้" → clarify ถามเวลา

📌 สร้างงาน/to-do (create_task) — ต้องมี: ชื่อ (วัน/เวลา optional)
  ✅ "ซื้อน้ำตาล"
  ✅ "ต่อทะเบียนรถ"
  ✅ "ไปรับลูก 4 โมง"
  ✅ "ต้องจ่ายค่าเน็ตวันศุกร์"

📌 จดบันทึก (create_note) — ต้องมี: ชื่อ + เนื้อหา
  ✅ "จำไว้ว่ารหัส wifi คือ 12345"
  ✅ "pass wifi = hello123"
  ✅ "จดเลขบัญชี 1234567890"

📌 กิจวัตรรายสัปดาห์ (create_routine) — ต้องมี: ชื่อ + เวลา
  ✅ "วิ่งทุกเช้า 6 โมง"
  ✅ "กินยาทุกวัน เที่ยง"
  ✅ "ออกกำลังกายวันจันทร์-ศุกร์ 5 โมงเย็น"
  ❌ "กินยาทุกวัน" → clarify ถามเวลา

📌 กิจวัตรรายเดือน (create_monthly_routine) — ต้องมี: ชื่อ + วันที่ของเดือน
  ✅ "จ่ายค่าบ้านทุกวันที่ 5"
  ✅ "จ่ายค่าเน็ตทุกสิ้นเดือน"
  ✅ "จ่ายค่าไฟวันที่ 15 ทุกเดือน 4 ทุ่ม"
  ❌ "จ่ายค่าเน็ตทุกเดือน" → clarify ถามวันที่

📌 แก้ไข — ต้องมี: ชื่อรายการเดิม + สิ่งที่จะเปลี่ยน
  ✅ "เลื่อนนัดหมอเป็นวันศุกร์"
  ✅ "เปลี่ยนเวลาประชุมเป็นบ่าย 3"
  ✅ "แก้กิจวัตรกินยาเป็น 2 ทุ่ม"
  ✅ "แก้ค่าบ้านเป็นวันที่ 25"

📌 ลบ — ต้องมี: ชื่อรายการ
  ✅ "ลบนัดหมอ" / "ยกเลิกนัดหมอ" / "ไม่ไปหมอแล้ว"
  ✅ "ลบงานซื้อน้ำตาล"
  ✅ "ลบทั้งหมด" / "เคลียร์หมด"

📌 ถามดูรายการ (query)
  ✅ "มีนัดอะไรบ้าง" / "ว่างไหมพรุ่งนี้" / "วันนี้ต้องทำอะไร"

📌 ค้นหา (search)
  ✅ "ราคาทองวันนี้" / "อากาศพรุ่งนี้"

📌 แชททั่วไป (chat)
  ✅ "เหนื่อยจัง" / "สวัสดี" / "555" / "ขอบคุณนะ"

=== กฎจัดการ edge cases ===

1. พิมพ์ผิด/ตัวย่อ/สลับภาษา — พยายามเข้าใจเจตนาแม้สะกดผิด
   "พุ่งนี้" = "พรุ่งนี้", "มะรืน" = "มะรืนนี้"
   "ปชม" = "ประชุม", "นดหมอ" = "นัดหมอ"
   ถ้าพิมพ์ภาษาอังกฤษแต่เจตนาเป็นไทย (เช่น "mkpvl" = ลืมเปลี่ยนภาษา) → ใช้ clarify ถามว่าหมายถึงอะไร

2. Compound request (หลายคำสั่งใน 1 ข้อความ) — จับแค่คำสั่งแรก
   "นัดหมอพรุ่งนี้ 10 โมง แล้วก็ซื้อนมด้วย" → create_event (นัดหมอ) เท่านั้น
   ⚠️ ห้ามพยายามทำหลายคำสั่งพร้อมกัน จับแค่อันแรกที่ชัดที่สุด

3. ข้อความยาวที่ซ่อนคำสั่ง — ถ้าเป็นเรื่องเล่า + มีคำสั่งซ่อน → จับคำสั่งที่ชัดที่สุด
   "วันนี้ไปหาหมอ หมอบอกว่าต้องกินยาทุกวัน 8 โมง" → create_routine (กินยา 08:00)
   "เพิ่งนัดหมอ ต้องไปอีกทีวันที่ 15 บ่าย 2" → create_event (หมอ วันที่ 15 14:00)
   ⚠️ ถ้าไม่ชัวร์ว่า user ต้องการสร้างจริง → ใช้ clarify ถามก่อน

4. เวลา/วันไม่ชัด — ถ้าคลุมเครือ → clarify ถาม
   "เช้าๆ" "ตอนเช้า" "ช่วงบ่าย" → clarify ถามเวลาที่แน่นอน
   "สัปดาห์หน้า" "เร็วๆ นี้" "วันหยุด" → clarify ถามวันที่แน่นอน
   ✅ "เช้า 8 โมง" "บ่าย 3" → ใช้ได้ มีเวลาชัด

5. Emoji/sticker ที่อาจเป็นการยืนยัน — ไม่แปลงเป็น command
   "👍" "🙏" "❤️" → intent: chat
   "ครับบบบบ" "ค่ะะะะ" → intent: chat (ไม่ใช่ confirm เพราะไม่มี pending command)
   "555555" → intent: chat

6. เปลี่ยนคำสั่งกลางทาง (ไม่ตอบ ใช่/ไม่ แต่เปลี่ยนข้อมูล)
   ระบบจะจัดการตรงนี้ใน route.ts ไม่ต้องทำใน intent analyzer

7. ถามย้อน AI — ถ้า user ถามกลับแทนตอบ → intent: query หรือ chat ตามเนื้อหา
   "ว่างวันไหนบ้าง" → intent: query
   "แนะนำหน่อย" → intent: chat

=== ตัวอย่าง edge cases ===
"นัดหมอพุ่งนี้ 10 โมง" → {"intent":"create_event","title":"หาหมอ","date":"{{TOMORROW}}","time":"10:00"}
"ปชม วันศุกร์ 3 ทุ่ม" → {"intent":"create_event","title":"ประชุม","date":"...","time":"21:00"}
"นัดหมอพรุ่งนี้ 10 โมง แล้วก็ซื้อนมด้วย" → {"intent":"create_event","title":"หาหมอ","date":"{{TOMORROW}}","time":"10:00"}
"วันนี้ไปหาหมอ หมอบอกกินยาทุกวัน 8 โมง" → {"intent":"create_routine","title":"กินยา","routine_time":"08:00","days_of_week":[0,1,2,3,4,5,6]}
"นัดหมอเช้าๆ" → {"intent":"clarify","clarifyMessage":"อยากนัดหมอตอนเช้ากี่โมงคะ?","choices":[]}
"นัดหมอสัปดาห์หน้า" → {"intent":"clarify","clarifyMessage":"นัดหมอสัปดาห์หน้าวันไหน กี่โมงคะ?","choices":[]}
"นัดหมอเมื่อวาน" → {"intent":"clarify","clarifyMessage":"วันนั้นผ่านไปแล้วนะคะ ต้องการวันไหนแทนคะ?","choices":[]}
"👍" → {"intent":"chat"}
"ครับบบบบ" → {"intent":"chat"}
"555555" → {"intent":"chat"}
"..." → {"intent":"chat"}
"asdfghjkl" → {"intent":"chat"}
"ว่างวันไหนบ้าง" → {"intent":"query"}
"วันไหนก็ได้" → {"intent":"clarify","clarifyMessage":"งั้นช่วยบอกวันที่และเวลาที่สะดวกที่สุดนะคะ เช่น พรุ่งนี้ 10 โมง","choices":[]}
"แล้วแต่เลย" → {"intent":"clarify","clarifyMessage":"ช่วยเลือกวันและเวลาให้หน่อยนะคะ เพื่อจะได้ตั้งเตือนได้ถูกต้อง","choices":[]}

=== กฎเพิ่มเติม: ป้องกันข้อมูลผิด ===
- ห้ามใส่ date ที่ผ่านไปแล้ว (ก่อน {{TODAY}}) — ถ้า user พูดถึงวันที่ผ่านแล้ว → clarify ถามวันใหม่
- ถ้า user ตอบคลุมเครือเช่น "วันไหนก็ได้" "แล้วแต่" "ไม่รู้" → clarify ขอข้อมูลที่ชัดเจน ไม่เดาเอง
- ข้อความที่ไม่มีความหมาย ("...", "asdfghjkl", สัญลักษณ์แปลกๆ) → intent: chat

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

    let response: string = '';

    // Groq primary (30 RPM) → retry 1 ครั้งถ้า 429 → Gemini fallback (5 RPM)
    const callGroqIntent = async (): Promise<string> => {
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
      return data.choices?.[0]?.message?.content?.trim() || '';
    };

    const callGeminiIntent = async (): Promise<string> => {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      });
      const result = await model.generateContent(`${prompt}\n\nข้อความ: "${message}"`);
      return result.response.text().trim();
    };

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    if (process.env.GROQ_API_KEY) {
      try {
        response = await callGroqIntent();
      } catch (err1: any) {
        const is429 = String(err1?.message || '').includes('429');
        if (is429) {
          // Retry 1 ครั้งหลัง 3 วินาที
          console.warn('Groq 429 → retry in 3s...');
          await delay(3000);
          try {
            response = await callGroqIntent();
          } catch (err2: any) {
            console.warn('Groq retry failed → fallback Gemini');
            if (process.env.GEMINI_API_KEY) {
              response = await callGeminiIntent();
            } else {
              throw err2;
            }
          }
        } else if (process.env.GEMINI_API_KEY) {
          console.warn('Groq error → fallback Gemini:', err1?.message?.slice(0, 80));
          response = await callGeminiIntent();
        } else {
          throw err1;
        }
      }
    } else if (process.env.GEMINI_API_KEY) {
      response = await callGeminiIntent();
    } else {
      throw new Error('No AI API key configured');
    }

    // Parse JSON จาก response (อาจมี markdown code block)
    if (!response) throw new Error('Empty AI response');
    const jsonStr = response.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    if (!jsonStr) throw new Error('Empty JSON after cleanup');
    const parsed = JSON.parse(jsonStr);

    const intent = parsed.intent || 'chat';

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
      assigned_to: parsed.assigned_to,
      raw: message,
    };
  } catch (error) {
    console.error('Intent analysis error:', error);
    // AI ไม่พร้อม → fallback เป็น chat เพื่อความปลอดภัย
    return { intent: 'chat', raw: message };
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
