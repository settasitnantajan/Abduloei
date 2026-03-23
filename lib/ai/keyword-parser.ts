/**
 * Keyword-Based Command Parser for Thai Language
 * แปลงคำสั่งภาษาไทยเป็น JSON โดยใช้ keyword
 */

import { ParsedCommand, CommandType, Priority, ChecklistItemParsed } from '@/lib/types/command'
import { parseThaiDate } from '@/lib/utils/thai-date-parser'

/**
 * แปลงข้อความภาษาไทยเป็น ParsedCommand
 * @param text ข้อความจากผู้ใช้
 * @returns ParsedCommand หรือ null ถ้าไม่ใช่คำสั่ง
 */
export function parseCommand(text: string): ParsedCommand | null {
  const normalized = text.toLowerCase().trim()

  // ตรวจสอบว่าเป็นคำสั่งหรือไม่
  const commandType = detectCommandType(normalized)
  if (!commandType) {
    return null
  }

  // แยกวันที่และเวลา
  const { date, time } = parseThaiDate(normalized)

  // แยก title (หัวข้อ)
  const title = extractTitle(normalized, commandType)

  // แยก priority (ความสำคัญ)
  const priority = extractPriority(normalized)

  // แยก description (รายละเอียด)
  const description = extractDescription(normalized)

  // แยก checklist items (สำหรับ events)
  const checklistItems = commandType === 'create_event' ? extractChecklistItems(text) : undefined

  return {
    type: commandType,
    title,
    date,
    time,
    description,
    priority,
    checklist_items: checklistItems,
    raw: text
  }
}

/**
 * ตรวจว่าเป็นการเล่าเรื่อง (narration) หรือไม่
 * เล่าเรื่อง = มีอารมณ์/ความรู้สึก หรือ pattern อดีตกาล
 */
function isNarration(text: string): boolean {
  // คำแสดงอารมณ์/ความรู้สึก + แสลง + อุทาน + สัญลักษณ์แชท
  const emotionWords = [
    'หล่อมาก', 'สวยมาก', 'เหนื่อย', 'ตื่นเต้น', 'อร่อย',
    'ดีใจ', 'เสียใจ', 'สนุก', 'เบื่อ', 'โกรธ', 'กลัว',
    'ตกใจ', 'ประทับใจ', 'น่ารัก', 'เท่มาก', 'เจ๋ง',
    'แจ่ม', 'โคตร', 'โหดมาก', 'เยี่ยม', 'ดีมาก',
    'แย่มาก', 'เศร้า', 'ท้อ', 'หิว', 'ง่วง',
    'ตลก', 'ฮา', 'ขำ', 'ชอบมาก', 'รักเลย',
    // แสลง 2024-2025
    'ปัง', 'สุดปัง', 'เริ่ด', 'เริศ', 'ฉ่ำ', 'ตัวแม่', 'แม่มาก',
    'ตัวตึง', 'ทำถึง', 'ยืนหนึ่ง', 'จุ้ง', 'เฉียบ', 'บ้ง',
    'มงลง', 'ว้าวซ่า', 'เลิฟ', 'ของแทร่', 'นอยด์', 'ดราม่า',
    // อุทาน
    'โอ้โห', 'ว้าว', 'แม่เจ้า', 'บ้าไปแล้ว', 'จริงดิ', 'ตายแล้ว',
    // สัญลักษณ์แชท
    '555', 'อิอิ'
  ]

  for (const word of emotionWords) {
    if (text.includes(word)) return true
  }

  // Pattern อดีตกาล: "วันนี้...มา", "เมื่อวาน..."
  if (/วันนี้.+มา(\s|$)/.test(text)) return true
  if (/เมื่อวาน/.test(text)) return true
  // "ไป...มา" pattern (เล่าว่าไปมาแล้ว)
  if (/ไป.+มา(\s|$)/.test(text)) return true

  // Thai aspect markers (อดีต/สำเร็จ)
  if (/.+แล้ว/.test(text)) return true
  if (/เพิ่ง|พึ่ง/.test(text)) return true
  if (/เมื่อกี้|ตะกี้/.test(text)) return true
  if (/เคย/.test(text)) return true
  // ได้ + V = achievement/past
  if (/ได้(เจอ|ไป|กิน|ทำ|ดู|เห็น)/.test(text)) return true

  return false
}

/**
 * ตรวจว่ามีคำสั่งสร้างนัดชัดเจนหรือไม่
 */
function hasExplicitCreateCommand(text: string): boolean {
  const createCommands = [
    'สร้างนัด', 'ตั้งนัด', 'นัดหมาย', 'จองคิว',
    'อย่าลืม', 'ต้องไป', 'นัดให้', 'สร้างกิจกรรม',
    'เพิ่มนัด', 'บันทึกนัด', 'ตั้งเวลา',
    // ภาษาพูด/แสลง
    'จัดไป', 'ลุย', 'set นัด', 'เตือนว่าต้อง',
    // ภาษาผสม
    'สร้าง event', 'add นัด', 'เพิ่ม event',
  ]

  for (const cmd of createCommands) {
    if (text.includes(cmd)) return true
  }

  return false
}

/**
 * ตรวจสอบประเภทของคำสั่ง
 * ปรับ logic: แยก narration (เล่าเรื่อง) กับ command (สั่งสร้างนัด)
 */
function detectCommandType(text: string): CommandType | null {
  const hasDateOrTime = hasDateTime(text)

  // === Priority 1: ถ้ามีวันที่/เวลา → ตรวจสอบเพิ่มเติม ===
  if (hasDateOrTime) {
    const narration = isNarration(text)
    const explicitCreate = hasExplicitCreateCommand(text)

    // 1. เป็นเล่าเรื่อง + ไม่มีคำสั่งสร้างชัดเจน → chat (return null)
    if (narration && !explicitCreate) {
      return null
    }

    // 2. มีคำสั่งสร้างนัดชัดเจน → create_event
    if (explicitCreate) {
      return 'create_event'
    }

    // 3. มี strong keyword (นัด, ประชุม, สอบ, หมอ, ทันตกรรม) → create_event
    const strongKeywords = [
      'นัด', 'ประชุม', 'สอบ', 'หมอ', 'ทันตกรรม',
      'สัมภาษณ์', 'เรียน', 'ฝึก', 'อบรม',
      // เพิ่ม
      'meeting', 'ฟิตเนส', 'กินข้าว', 'งานแต่ง',
      'เที่ยว', 'คอนเสิร์ต', 'ดูหนัง',
    ]

    for (const keyword of strongKeywords) {
      if (text.includes(keyword)) {
        return 'create_event'
      }
    }

    // 4. มีแค่ weak keyword (ไป, เจอ, งาน, มา, พบ) → chat (return null)
    //    เพราะอาจเป็นแค่เล่าเรื่อง
    const weakKeywords = ['ไป', 'เจอ', 'งาน', 'มา', 'พบ', 'มี', 'ทำงาน']
    let hasOnlyWeakKeywords = false
    for (const keyword of weakKeywords) {
      if (text.includes(keyword)) {
        hasOnlyWeakKeywords = true
        break
      }
    }

    if (hasOnlyWeakKeywords) {
      return null
    }

    // 5. มี imperative particle (สิ, ดิ, เถอะ, เหอะ, ซะ) + datetime → create_event
    if (/[สดเซ](ิ|ี|ะ|อะ|ะ)$/.test(text) || /(สิ|ดิ|เถอะ|เหอะ|ซะ|นะ)$/.test(text.replace(/\s+$/g, ''))) {
      return 'create_event'
    }

    // 6. ถ้ามี datetime + คำว่า "ต้อง" หรือ "จะ" → create_event (มีเจตนาชัดเจน)
    if (text.includes('ต้อง') || text.includes('จะ')) {
      return 'create_event'
    }

    // 7. ถ้ามี datetime แต่ไม่ match อะไรเลย → return null (ปลอดภัยไว้ก่อน)
    return null
  }

  // === Priority 2: ไม่มีวันที่/เวลา → เช็ค Task keywords ===
  const taskKeywords = [
    'ต้อง', 'ซื้อ', 'จ่าย', 'ทำ', 'จัดการ', 'แก้ไข',
    'ส่ง', 'โทร', 'อ่าน', 'เขียน', 'จด', 'เช็ค',
    'ตรวจสอบ', 'เตรียม', 'จอง',
    // เพิ่ม
    'เพิ่มงาน', 'todo', 'to-do', 'สร้างงาน',
    'ไปรับ', 'ไปส่ง', 'ต่อภาษี', 'ต่อทะเบียน',
  ]

  for (const keyword of taskKeywords) {
    if (text.includes(keyword)) {
      return 'create_task'
    }
  }

  // === Priority 3: Note keywords ===
  const noteKeywords = [
    'จำ', 'บันทึก', 'จด', 'เก็บ', 'ข้อมูล',
    'ไว้', 'เตือน', 'อย่าลืม',
    // เพิ่ม
    'โน้ต', 'note', 'เมโม', 'memo', 'save',
    'จดไว้', 'จำด้วย', 'จดหน่อย',
  ]

  for (const keyword of noteKeywords) {
    if (text.includes(keyword)) {
      return 'create_note'
    }
  }

  return null
}

/**
 * ตรวจสอบว่าข้อความมีวันที่หรือเวลาหรือไม่
 */
function hasDateTime(text: string): boolean {
  const dateTimeKeywords = [
    'วันนี้', 'พรุ่งนี้', 'พรุ่ง', 'มะรืน', 'เย็นนี้', 'ค่ำนี้', 'คืนนี้',
    'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์',
    'โมง', 'นาที', ':', '.',
    'เช้า', 'บ่าย', 'เย็น', 'ค่ำ', 'ทุ่ม', 'ตี',
    'เที่ยง', 'เที่ยงคืน', 'เช้ามืด',
    'สิ้นเดือน', 'ต้นเดือน',
  ]

  for (const keyword of dateTimeKeywords) {
    if (text.includes(keyword)) {
      return true
    }
  }

  // ตรวจสอบเดือน
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]

  for (const month of months) {
    if (text.includes(month)) {
      return true
    }
  }

  // ตรวจสอบรูปแบบเลข (เช่น "14:00", "10 มี.ค.")
  if (/\d{1,2}[:.]/.test(text)) {
    return true
  }

  // "27/3", "27-3"
  if (/\d{1,2}[/\-]\d{1,2}/.test(text)) {
    return true
  }

  // "วันที่ 27 เดือน 3"
  if (/วันที่\s*\d/.test(text)) {
    return true
  }

  // "อีก X วัน"
  if (/อีก\s*\d+\s*วัน/.test(text)) {
    return true
  }

  // คำย่อวัน: จ., อ., พ., พฤ., ศ., ส., อา.
  if (/(?:^|\s|วัน)(?:จ\.|อ\.|พ\.|พฤ\.|ศ\.|ส\.|อา\.)/.test(text)) {
    return true
  }

  return false
}

/**
 * แยกหัวข้อจากข้อความ
 */
function extractTitle(text: string, commandType: CommandType): string {
  let title = text

  // สำหรับ Event: ตัดทิ้งทุกอย่างหลัง checklist indicators
  if (commandType === 'create_event') {
    const checklistMatch = title.match(/(.*?)\s*(อย่าลืม|ต้อง(?!การ)|และ(?!.{1,5}$))/)
    if (checklistMatch && checklistMatch[1].trim().length > 0) {
      title = checklistMatch[1].trim()
    }
  }

  // ลบคำที่ไม่จำเป็น
  const removePatterns = [
    // วันที่และเวลา
    /วันนี้|พรุ่งนี้|มะรืน/gi,
    /วัน(จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์)/gi,
    /\d{1,2}\s*(โมง|นาที|:\d{2}|.\d{2})/gi,
    /(เช้า|บ่าย|เย็น|ค่ำ|ทุ่ม)/gi,
    /\d{1,2}\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/gi,
    /(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)/gi,

    // Priority
    /(สำคัญ|ด่วน|เร่งด่วน|ไม่ด่วน)/gi,

    // คำเชื่อม
    /^(ต้อง|ซื้อ|จ่าย|จำ|บันทึก|จด)\s*/gi,
    /\s+(ไว้|ด้วย|นะ|ครับ|ค่ะ|คะ)\s*$/gi
  ]

  for (const pattern of removePatterns) {
    title = title.replace(pattern, ' ')
  }

  // ทำความสะอาด
  title = title.trim().replace(/\s+/g, ' ')

  // ถ้าเหลือแค่คำเดียวหรือสั้นเกินไป
  if (!title || title.length < 2) {
    title = text.slice(0, 50)
  }

  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1)
}

/**
 * แยกระดับความสำคัญ
 */
function extractPriority(text: string): Priority | undefined {
  if (text.includes('เร่งด่วน') || text.includes('ด่วนมาก')) {
    return 'high'
  }
  if (text.includes('สำคัญ') || text.includes('ด่วน')) {
    return 'high'
  }
  if (text.includes('ไม่ด่วน') || text.includes('ไม่สำคัญ')) {
    return 'low'
  }
  return 'medium'
}

/**
 * แยกรายละเอียดเพิ่มเติม
 */
function extractDescription(text: string): string | undefined {
  // ถ้ามีคำว่า "เพราะ", "เนื่องจาก", "เพื่อ"
  const descriptionMatch = text.match(/(เพราะ|เนื่องจาก|เพื่อ|สำหรับ|โดย)\s*(.+)/i)
  if (descriptionMatch) {
    return descriptionMatch[2].trim()
  }

  return undefined
}

/**
 * สร้างข้อความตอบกลับจาก ParsedCommand (สำหรับ AI)
 */
export function formatCommandResponse(command: ParsedCommand): string {
  const typeMap: Record<CommandType, string> = {
    create_event: 'นัดหมาย',
    create_task: 'งาน',
    create_note: 'บันทึก',
    delete_all: 'ลบทั้งหมด',
    edit_event: 'แก้ไขนัดหมาย'
  }

  const typeName = typeMap[command.type]
  let response = `บันทึก${typeName} "${command.title}"`

  if (command.date) {
    const date = new Date(command.date)
    const day = date.getDate()
    const month = date.getMonth() + 1
    response += ` วันที่ ${day}/${month}`
  }

  if (command.time) {
    response += ` เวลา ${command.time} น.`
  }

  if (command.priority === 'high') {
    response += ' (สำคัญ)'
  }

  response += ' แล้วนะคะ'

  return response
}

/**
 * แยก Checklist Items จากข้อความ
 * รองรับ patterns: "ต้อง...", "อย่าลืม...", "และ..."
 * รองรับ context "ใส่ใน[X]" เช่น "เอาเสื้อใส่ในกระเป๋า" → "เสื้อ (ใส่ในกระเป๋า)"
 */
function extractChecklistItems(text: string): ChecklistItemParsed[] | undefined {
  const items: ChecklistItemParsed[] = []

  // === Strategy 1: แยกด้วย "อย่าลืม" / "ต้อง" เป็น segment delimiter ===
  const segmentPattern = /(?:อย่าลืม|ต้อง(?!การ))\s*(.+?)(?=(?:\s*อย่าลืม|\s*ต้อง(?!การ))|$)/g
  let match

  while ((match = segmentPattern.exec(text)) !== null) {
    let segment = match[1].trim()
    if (!segment || segment.length === 0) continue

    // ตัดคำลงท้าย: ด้วย, นะ, ครับ, ค่ะ
    segment = segment.replace(/\s*(ด้วย|นะ|ครับ|ค่ะ|คะ)\s*$/g, '').trim()

    // ถ้า segment มี "และ/กับ" → แยกเป็นหลาย items
    if (/และ|กับ/.test(segment)) {
      const subItems = segment.split(/\s*(?:และ|กับ)\s*/)
      for (const sub of subItems) {
        const processed = processChecklistSegment(sub.trim())
        if (processed) addUniqueItem(items, processed)
      }
    } else {
      const processed = processChecklistSegment(segment)
      if (processed) addUniqueItem(items, processed)
    }
  }

  // === Strategy 2 (fallback): ถ้า Strategy 1 ไม่ได้ผล → ใช้ "และ" splitter เดิม ===
  if (items.length === 0) {
    const andPattern = /และ([^และ]+?)(?=และ|$)/g
    while ((match = andPattern.exec(text)) !== null) {
      const itemText = match[1].trim()
      if (itemText && itemText.length > 0 && !itemText.includes('ไป') && !itemText.includes('มา')) {
        const { title, assignee } = extractAssignee(itemText)
        if (title) addUniqueItem(items, { title, assignee })
      }
    }
  }

  return items.length > 0 ? items : undefined
}

/**
 * ประมวลผล segment เดี่ยว → ChecklistItemParsed
 * จัดการ "ใส่ใน[X]", "เอาไว้ใน[X]" เพื่อเก็บ context ไว้ใน title
 */
function processChecklistSegment(segment: string): ChecklistItemParsed | null {
  if (!segment || segment.length === 0) return null

  // ตรวจจับ "ใส่ใน[X]" / "ใส่ไว้ใน[X]" / "เอาไว้ใน[X]"
  const containerMatch = segment.match(/(.+?)\s*(?:ใส่(?:ไว้)?ใน|เอาไว้ใน|อยู่ใน)\s*(.+)/)

  let title: string
  if (containerMatch) {
    const itemName = cleanItemName(containerMatch[1])
    const container = cleanItemName(containerMatch[2])
    title = `${itemName} (ใส่ใน${container})`
  } else {
    title = cleanItemName(segment)
  }

  if (!title || title.length < 2) return null

  const { title: finalTitle, assignee } = extractAssignee(title)
  if (!finalTitle) return null

  return { title: finalTitle, assignee }
}

/**
 * ทำความสะอาดชื่อ item — ตัดคำนำและคำลงท้ายที่ไม่จำเป็น
 */
function cleanItemName(text: string): string {
  return text
    .replace(/^(เอา|พา|หิ้ว)\s*/g, '')  // ตัดคำนำ (ไม่ตัด "นำ" เพราะ "นำเสนอ")
    .replace(/^(นำ)(?=\s)/g, '')  // ตัด "นำ " (มี space ตาม) แต่ไม่ตัด "นำเสนอ"
    .replace(/\s*(ไป|มา|ด้วย|นะ|ครับ|ค่ะ|คะ)\s*$/g, '')  // ตัดคำลงท้าย
    .trim()
}

/**
 * เพิ่ม item เข้า list โดยไม่ซ้ำ
 */
function addUniqueItem(items: ChecklistItemParsed[], newItem: ChecklistItemParsed) {
  const isDuplicate = items.some(item => item.title === newItem.title)
  if (!isDuplicate) {
    items.push(newItem)
  }
}

/**
 * แยก assignee ออกจาก title
 * รองรับ patterns: "บอก[ชื่อ]ว่า...", "แจ้ง[ชื่อ]ว่า...", "ให้[ชื่อ]...", "[ชื่อ]ต้อง..."
 */
function extractAssignee(text: string): { title: string; assignee?: string } {
  // Pattern 1: "บอก[ชื่อ]ว่า..." หรือ "แจ้ง[ชื่อ]ว่า..."
  const tellPattern = /(บอก|แจ้ง)([ก-๙a-zA-Z]+)ว่า(.+)/
  let match = text.match(tellPattern)
  if (match) {
    return {
      title: match[3].trim(),
      assignee: match[2].trim()
    }
  }

  // Pattern 2: "ให้[ชื่อ]..."
  const givePattern = /ให้([ก-๙a-zA-Z]+)(.+)/
  match = text.match(givePattern)
  if (match) {
    return {
      title: match[2].trim(),
      assignee: match[1].trim()
    }
  }

  // Pattern 3: "[ชื่อ]ต้อง..."
  const namePattern = /^([ก-๙a-zA-Z]+)ต้อง(.+)/
  match = text.match(namePattern)
  if (match) {
    return {
      title: match[2].trim(),
      assignee: match[1].trim()
    }
  }

  // ไม่พบ assignee - คืน title เต็ม
  return { title: text.trim() }
}

/**
 * ตรวจสอบว่าเป็นคำสั่งแก้ไขนัดหมายหรือไม่
 */
export function isEditCommand(text: string): boolean {
  const normalized = text.toLowerCase()
  const editKeywords = [
    'แก้ไขนัด', 'เปลี่ยนนัด', 'อัปเดตนัด', 'เลื่อนนัด',
    'แก้นัด', 'เปลี่ยนแปลงนัด',
    'edit นัด', 'update นัด',
  ]
  for (const keyword of editKeywords) {
    if (normalized.includes(keyword)) return true
  }
  // "แก้ไข/เปลี่ยน" + มีบริบทนัดหมาย (เช่น วันที่ + ชื่อกิจกรรม)
  if (/(?:แก้ไข|เปลี่ยน|อัปเดต|เลื่อน).*(?:นัด|หมาย|ประชุม|หมอ|กิจกรรม|event)/.test(normalized)) return true
  if (/(?:นัด|หมาย|ประชุม|หมอ|กิจกรรม|event).*(?:แก้ไข|เปลี่ยน|อัปเดต|เลื่อน)/.test(normalized)) return true
  return false
}

/**
 * ตรวจสอบว่าเป็นคำสั่งลบทั้งหมดหรือไม่
 */
export function isDeleteAllCommand(text: string): boolean {
  const normalized = text.toLowerCase()
  const deleteKeywords = [
    'ลบทั้งหมด', 'ลบนัด', 'ลบงาน', 'ลบบันทึก',
    'เคลียร์', 'ล้างข้อมูล', 'ล้างทั้งหมด', 'ล้างนัด', 'ล้างงาน',
    'ลบหมด', 'เคลียร์หมด', 'ลบรายการ',
    // ภาษาพูด
    'ยกเลิกนัด', 'แคนเซิลนัด', 'cancel นัด',
    'ไม่ไป', 'ไม่ไปแล้ว',
  ]
  for (const keyword of deleteKeywords) {
    if (normalized.includes(keyword)) return true
  }
  // "ยกเลิก" + ชื่อนัด (แต่ไม่ใช่ "ยกเลิก" เปล่าๆ ซึ่งอาจเป็น reject confirmation)
  if (/ยกเลิก.{2,}/.test(normalized) && !normalized.startsWith('ยกเลิก')) {
    return false
  }
  if (/^ยกเลิก.{3,}/.test(normalized)) return true

  return false
}

/**
 * ตรวจสอบว่าเป็นคำถามขอข้อมูลหรือไม่ (query)
 */
export function isQueryCommand(text: string): boolean {
  const normalized = text.toLowerCase()

  // ถ้ามีคำสั่งสร้าง/ลบชัดเจน → ไม่ใช่ query
  const nonQueryKeywords = [
    'สร้างนัด', 'ตั้งนัด', 'เพิ่มนัด', 'นัดให้', 'สร้างกิจกรรม',
    'ลบนัด', 'ลบงาน', 'ลบบันทึก', 'ลบทั้งหมด', 'ยกเลิกนัด',
    'เคลียร์', 'ล้าง', 'จองคิว', 'บันทึกนัด',
  ]
  // เช็คว่ามีทั้ง nonQuery + query keyword หรือเปล่า ถ้ามี query keyword ชัดเจน (อะไรบ้าง, มีไหม) → ให้เป็น query
  const hasQuerySignal = /อะไรบ้าง|มีไหม|มีมั้ย|มีมะ|ว่างไหม|ว่างมั้ย|ดูนัด|เช็คนัด/.test(normalized)
  if (!hasQuerySignal) {
    for (const kw of nonQueryKeywords) {
      if (normalized.includes(kw)) return false
    }
  }

  // คำที่ชัดเจนว่าเป็น query (ไม่คลุมเครือ)
  const strongQueryKeywords = [
    'มีนัด', 'มีอะไร', 'นัดอะไรบ้าง', 'งานอะไรบ้าง',
    'ต้องทำอะไร', 'วันนี้มีอะไร', 'พรุ่งนี้มีอะไร',
    'แสดงรายการ', 'ดูรายการ', 'ดูนัด', 'ดูงาน',
    'มีไหม', 'มีมั้ย', 'มีมะ', 'มีกี่รายการ', 'อะไรบ้าง',
    // ภาษาพูด
    'ว่างไหม', 'ว่างมั้ย', 'ว่างมะ', 'ว่างป่ะ',
    'ตารางวัน', 'เช็คนัด', 'เช็กนัด', 'check นัด',
    'มีงานค้าง', 'งานค้าง', 'to-do', 'todo',
    // ถามนัด
    'นัดวันไหน', 'มีนัดมั้ย', 'มีนัดมะ',
  ]

  for (const keyword of strongQueryKeywords) {
    if (normalized.includes(keyword)) {
      return true
    }
  }

  // "ดู" ตามด้วย query context (ดูนัด, ดูให้หน่อย) — ไม่ใช่ "ดูหนัง", "ดูหมอ"
  if (/(?:^|[\s])ดู(?:ให้|หน่อย|ที|สิ|นัด|งาน|บันทึก|ทั้งหมด|ตาราง)/.test(normalized)) {
    return true
  }
  if (/(?:^|[\s])แสดง(?!ความ)/.test(normalized)) {
    return true
  }
  if (/(?:^|[\s])บอก(?:หน่อย|มา|ที|สิ)/.test(normalized)) {
    return true
  }

  // "พรุ่ง/วันนี้/วันศุกร์ + ว่าง" pattern
  if (/(?:พรุ่ง|วันนี้|จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์).*ว่าง/.test(normalized)) {
    return true
  }

  // "แล้ว...ล่ะ/ละ" — คำถามภาษาพูด เช่น "แล้วนัดอาทิตย์หน้าล่ะ", "แล้ววันที่ 22 ล่ะ"
  if (/^แล้ว.*(?:ล่ะ|ละ|หล่ะ|ล้ะ|อ่ะ|ล่ะ)\s*$/.test(normalized)) {
    return true
  }

  // "วันที่ X + ล่ะ/ละ" — เช่น "วันที่ 22 ล่ะ"
  if (/(?:วันที่|วัน\s*(?:จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์)).*(?:ล่ะ|ละ|ล้ะ|อ่ะ)\s*$/.test(normalized)) {
    return true
  }

  return false
}
