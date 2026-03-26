/**
 * Thai Date Parser
 * แปลงคำภาษาไทยเป็นวันที่ในรูปแบบ ISO (YYYY-MM-DD)
 * รองรับ: ตัวเลขไทย, คำย่อวัน, เวลาแบบไม่เป็นทางการ, ภาษาพูด
 */

export interface ParsedDateTime {
  date?: string // YYYY-MM-DD
  time?: string // HH:mm
  dateRange?: { from: string; to: string } // ช่วงวัน เช่น สัปดาห์นี้, เดือนนี้
  beforeDate?: string // YYYY-MM-DD — "ก่อนวันที่ X"
  afterDate?: string  // YYYY-MM-DD — "หลังวันที่ X"
}

/**
 * แปลงตัวเลขไทย ๐-๙ เป็น 0-9
 */
function convertThaiDigits(text: string): string {
  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙'
  return text.replace(/[๐-๙]/g, ch => String(thaiDigits.indexOf(ch)))
}

/**
 * แปลงวันที่ภาษาไทยเป็น ISO format
 */
export function parseThaiDate(text: string): ParsedDateTime {
  const result: ParsedDateTime = {}
  const today = new Date()

  // แปลงตัวเลขไทยเป็นอารบิก + lowercase
  const normalized = convertThaiDigits(text).toLowerCase().trim()

  // === วันที่ (Date) ===

  // วันนี้ / เย็นนี้ / ค่ำนี้
  if (/วันนี้|เย็นนี้|ค่ำนี้|คืนนี้/.test(normalized)) {
    result.date = formatDate(today)
  }

  // พรุ่งนี้ / พรุ่ง (ไม่มี "นี้")
  else if (/พรุ่งนี้|พรุ่ง(?!ๆ)/.test(normalized)) {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    result.date = formatDate(tomorrow)
  }

  // มะรืน
  else if (normalized.includes('มะรืน')) {
    const d = new Date(today)
    d.setDate(d.getDate() + 2)
    result.date = formatDate(d)
  }

  // "อีก X วัน"
  else {
    const relativeDay = normalized.match(/อีก\s*(\d+)\s*วัน/)
    if (relativeDay) {
      const d = new Date(today)
      d.setDate(d.getDate() + parseInt(relativeDay[1]))
      result.date = formatDate(d)
    }
  }

  // "สิ้นเดือน" / "สิ้นเดือนนี้"
  if (!result.date && /สิ้นเดือน/.test(normalized)) {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    result.date = formatDate(lastDay)
  }

  // "ต้นเดือนหน้า"
  if (!result.date && /ต้นเดือนหน้า/.test(normalized)) {
    const d = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    result.date = formatDate(d)
  }

  // วันในสัปดาห์: จันทร์, อ., พฤ. ฯลฯ + "นี้" vs "หน้า"
  if (!result.date) {
    const dayOfWeek = parseDayOfWeek(normalized)
    if (dayOfWeek !== null) {
      const isNextWeek = normalized.includes('หน้า')
      result.date = getNextWeekday(today, dayOfWeek, isNextWeek)
    }
  }

  // วันที่ + เดือน (10 มี.ค., 15 มีนาคม, 27/3, วันที่ 27 เดือน 3)
  if (!result.date) {
    const dateFromMonth = parseMonthDate(normalized, today.getFullYear())
    if (dateFromMonth) {
      result.date = dateFromMonth
    }
  }

  // === ก่อน/หลังวันที่ (Before/After Date) ===
  if (!result.date) {
    const beforeAfter = parseBeforeAfterDate(normalized, today)
    if (beforeAfter) {
      if (beforeAfter.type === 'before') {
        result.beforeDate = beforeAfter.date
      } else {
        result.afterDate = beforeAfter.date
      }
    }
  }

  // === ช่วงวัน (Date Range) ===
  if (!result.date && !result.beforeDate && !result.afterDate) {
    result.dateRange = parseDateRange(normalized, today)
  }

  // === เวลา (Time) ===
  result.time = parseTime(normalized)

  return result
}

/**
 * Parse "ก่อนวันที่ X" / "หลังวันที่ X"
 */
function parseBeforeAfterDate(text: string, today: Date): { type: 'before' | 'after'; date: string } | undefined {
  const year = today.getFullYear()

  // "ก่อนวันที่ X" / "ก่อนวันที่ X/Y"
  const beforeMatch = text.match(/ก่อน(?:วันที่)?\s*(\d{1,2})(?:\s*[/\-]\s*(\d{1,2}))?/)
  if (beforeMatch) {
    const day = parseInt(beforeMatch[1])
    const month = beforeMatch[2] ? parseInt(beforeMatch[2]) - 1 : today.getMonth()
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const date = new Date(year, month, day)
      return { type: 'before', date: formatDate(date) }
    }
  }

  // "หลังวันที่ X" / "หลังวันที่ X/Y"
  const afterMatch = text.match(/หลัง(?:วันที่)?\s*(\d{1,2})(?:\s*[/\-]\s*(\d{1,2}))?/)
  if (afterMatch) {
    const day = parseInt(afterMatch[1])
    const month = afterMatch[2] ? parseInt(afterMatch[2]) - 1 : today.getMonth()
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const date = new Date(year, month, day)
      return { type: 'after', date: formatDate(date) }
    }
  }

  return undefined
}

/**
 * Parse ช่วงวัน: สัปดาห์นี้, สัปดาห์หน้า, เดือนนี้, เดือน X
 */
function parseDateRange(text: string, today: Date): { from: string; to: string } | undefined {
  const year = today.getFullYear()

  // สัปดาห์นี้ / อาทิตย์นี้
  if (text.includes('สัปดาห์นี้') || /อาทิตย์นี้(?!$)/.test(text)) {
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { from: formatDate(monday), to: formatDate(sunday) }
  }

  // สัปดาห์หน้า / อาทิตย์หน้า
  if (text.includes('สัปดาห์หน้า') || text.includes('อาทิตย์หน้า')) {
    const dayOfWeek = today.getDay()
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? 1 : 8))
    const nextSunday = new Date(nextMonday)
    nextSunday.setDate(nextMonday.getDate() + 6)
    return { from: formatDate(nextMonday), to: formatDate(nextSunday) }
  }

  // เดือนนี้
  if (text.includes('เดือนนี้')) {
    const firstDay = new Date(year, today.getMonth(), 1)
    const lastDay = new Date(year, today.getMonth() + 1, 0)
    return { from: formatDate(firstDay), to: formatDate(lastDay) }
  }

  // เดือนหน้า
  if (text.includes('เดือนหน้า')) {
    const firstDay = new Date(year, today.getMonth() + 1, 1)
    const lastDay = new Date(year, today.getMonth() + 2, 0)
    return { from: formatDate(firstDay), to: formatDate(lastDay) }
  }

  // เดือน + เลข: "เดือน 4", "เดือน 12"
  const monthNumMatch = text.match(/เดือน\s*(\d{1,2})(?!\s*\d)/)
  if (monthNumMatch) {
    const month = parseInt(monthNumMatch[1]) - 1
    if (month >= 0 && month <= 11) {
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      return { from: formatDate(firstDay), to: formatDate(lastDay) }
    }
  }

  // เดือน + ชื่อ: "เดือนเมษา", "เดือนเมษายน"
  const thaiMonthNames: Record<string, number> = {
    'มกรา': 0, 'มกราคม': 0, 'กุมภา': 1, 'กุมภาพันธ์': 1,
    'มีนา': 2, 'มีนาคม': 2, 'เมษา': 3, 'เมษายน': 3,
    'พฤษภา': 4, 'พฤษภาคม': 4, 'มิถุนา': 5, 'มิถุนายน': 5,
    'กรกฎา': 6, 'กรกฎาคม': 6, 'สิงหา': 7, 'สิงหาคม': 7,
    'กันยา': 8, 'กันยายน': 8, 'ตุลา': 9, 'ตุลาคม': 9,
    'พฤศจิกา': 10, 'พฤศจิกายน': 10, 'ธันวา': 11, 'ธันวาคม': 11,
  }

  for (const [name, monthIndex] of Object.entries(thaiMonthNames)) {
    if (text.includes('เดือน' + name)) {
      const firstDay = new Date(year, monthIndex, 1)
      const lastDay = new Date(year, monthIndex + 1, 0)
      return { from: formatDate(firstDay), to: formatDate(lastDay) }
    }
  }

  return undefined
}

/**
 * แปลงชื่อวัน/คำย่อวัน เป็นเลข (0 = อาทิตย์, 1 = จันทร์, ...)
 * รองรับ: จันทร์, จ., อังคาร, อ., พุธ, พ., พฤหัส, พฤ., ศุกร์, ศ., เสาร์, ส., อาทิตย์, อา.
 */
function parseDayOfWeek(text: string): number | null {
  // ชื่อเต็มก่อน (เพื่อไม่ให้ "อาทิตย์" match กับ "อ.")
  if (text.includes('อาทิตย์')) return 0
  if (text.includes('จันทร์')) return 1
  if (text.includes('อังคาร')) return 2
  if (text.includes('พฤหัส') || text.includes('พฤหัสบดี')) return 4
  if (text.includes('ศุกร์')) return 5
  if (text.includes('เสาร์')) return 6
  // "พุธ" ต้องเช็คหลัง "พฤหัส" เพราะ "พ" อยู่ใน "พฤ"
  if (/(?:วัน)?พุธ/.test(text)) return 3

  // คำย่อ: จ., อ., พ., พฤ., ศ., ส., อา.
  if (/(?:^|\s|วัน)อา\./.test(text)) return 0
  if (/(?:^|\s|วัน)จ\./.test(text)) return 1
  if (/(?:^|\s|วัน)อ\./.test(text)) return 2  // อ. = อังคาร (default)
  if (/(?:^|\s|วัน)พ\.(?!ฤ)/.test(text)) return 3
  if (/(?:^|\s|วัน)พฤ\./.test(text)) return 4
  if (/(?:^|\s|วัน)ศ\./.test(text)) return 5
  if (/(?:^|\s|วัน)ส\./.test(text)) return 6

  return null
}

/**
 * หาวันถัดไปที่ตรงกับวันในสัปดาห์ที่กำหนด
 * isNextWeek = true → ข้ามไปสัปดาห์หน้าเสมอ
 */
function getNextWeekday(from: Date, targetDay: number, isNextWeek: boolean = false): string {
  const result = new Date(from)
  const currentDay = result.getDay()

  let daysToAdd = targetDay - currentDay
  if (daysToAdd <= 0) {
    daysToAdd += 7
  }
  if (isNextWeek && daysToAdd <= 7) {
    daysToAdd += 7
  }

  result.setDate(result.getDate() + daysToAdd)
  return formatDate(result)
}

/**
 * แปลงเดือน (10 มี.ค., 15 มีนาคม, 27/3, วันที่ 27 เดือน 3)
 */
function parseMonthDate(text: string, currentYear: number): string | null {
  const monthMap: Record<string, number> = {
    'ม.ค.': 0, 'มกราคม': 0, 'มกรา': 0,
    'ก.พ.': 1, 'กุมภาพันธ์': 1, 'กุมภา': 1,
    'มี.ค.': 2, 'มีนาคม': 2, 'มีนา': 2,
    'เม.ย.': 3, 'เมษายน': 3, 'เมษา': 3,
    'พ.ค.': 4, 'พฤษภาคม': 4, 'พฤษภา': 4,
    'มิ.ย.': 5, 'มิถุนายน': 5, 'มิถุนา': 5,
    'ก.ค.': 6, 'กรกฎาคม': 6, 'กรกฎา': 6,
    'ส.ค.': 7, 'สิงหาคม': 7, 'สิงหา': 7,
    'ก.ย.': 8, 'กันยายน': 8, 'กันยา': 8,
    'ต.ค.': 9, 'ตุลาคม': 9, 'ตุลา': 9,
    'พ.ย.': 10, 'พฤศจิกายน': 10, 'พฤศจิกา': 10,
    'ธ.ค.': 11, 'ธันวาคม': 11, 'ธันวา': 11,
  }

  // หาเลขวันที่ + ชื่อเดือน (10 มี.ค., 15 มีนาคม)
  const dayMatch = text.match(/(\d{1,2})\s*(?:มี\.ค\.|มีนาคม|มีนา|ก\.พ\.|กุมภาพันธ์|กุมภา|เม\.ย\.|เมษายน|เมษา|พ\.ค\.|พฤษภาคม|พฤษภา|มิ\.ย\.|มิถุนายน|มิถุนา|ก\.ค\.|กรกฎาคม|กรกฎา|ส\.ค\.|สิงหาคม|สิงหา|ก\.ย\.|กันยายน|กันยา|ต\.ค\.|ตุลาคม|ตุลา|พ\.ย\.|พฤศจิกายน|พฤศจิกา|ธ\.ค\.|ธันวาคม|ธันวา|ม\.ค\.|มกราคม|มกรา)/i)

  if (dayMatch) {
    const day = parseInt(dayMatch[1])

    for (const [monthName, monthIndex] of Object.entries(monthMap)) {
      if (text.includes(monthName)) {
        const date = new Date(currentYear, monthIndex, day)
        return formatDate(date)
      }
    }
  }

  // "27/3", "27-3", "วันที่ 27/3"
  const numericDateMatch = text.match(/(?:วันที่\s*)?(\d{1,2})\s*[/\-]\s*(\d{1,2})/)
  if (numericDateMatch) {
    const day = parseInt(numericDateMatch[1])
    const month = parseInt(numericDateMatch[2]) - 1
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const date = new Date(currentYear, month, day)
      return formatDate(date)
    }
  }

  // "วันที่ 27 เดือน 3", "ในวันที่ 27 เดือน 3"
  const thaiNumericMonth = text.match(/(?:ใน)?วันที่\s*(\d{1,2})\s*เดือน\s*(\d{1,2})/)
  if (thaiNumericMonth) {
    const day = parseInt(thaiNumericMonth[1])
    const month = parseInt(thaiNumericMonth[2]) - 1
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const date = new Date(currentYear, month, day)
      return formatDate(date)
    }
  }

  // "วันที่ 27" โดยไม่มีเดือน → ใช้เดือนปัจจุบัน
  const dayOnlyMatch = text.match(/วันที่\s*(\d{1,2})(?!\s*[/\-]\d|\s*เดือน)/)
  if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1])
    if (day >= 1 && day <= 31) {
      const today = new Date()
      const date = new Date(currentYear, today.getMonth(), day)
      return formatDate(date)
    }
  }

  return null
}

/**
 * แปลงเวลาภาษาไทย → HH:mm
 * รองรับ: 14:00, 14.00, ตี 3, บ่าย 2, บ่ายโมง, 3 ทุ่ม, เที่ยง, เที่ยงคืน
 *          9 โมงครึ่ง, บ่าย 2 ครึ่ง, X โมง Y นาที
 */
function parseTime(text: string): string | undefined {
  // "เที่ยงคืน"
  if (text.includes('เที่ยงคืน')) return '00:00'

  // "เที่ยง" / "เที่ยงวัน" (ต้องเช็คหลัง เที่ยงคืน)
  if (/เที่ยง(?:วัน)?/.test(text) && !text.includes('เที่ยงคืน')) return '12:00'

  // รูปแบบ HH:mm หรือ HH.mm (เช่น 14:00, 14.30)
  // ต้องไม่ match วันที่ เช่น 27/3 (ใช้ : หรือ . ที่ไม่ตามด้วย / ข้างหน้า)
  const timeMatch = text.match(/(?<!\d[/\-])(\d{1,2})[:.](\d{2})(?![/\-]\d)/)
  if (timeMatch) {
    const hour = parseInt(timeMatch[1])
    const minute = parseInt(timeMatch[2])
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    }
  }

  // "ตี X" (ตี 1 = 01:00, ตี 2 = 02:00, ... ตี 5 = 05:00)
  const teeMatch = text.match(/ตี\s*(\d{1})/)
  if (teeMatch) {
    const hour = parseInt(teeMatch[1])
    if (hour >= 1 && hour <= 5) {
      return `${hour.toString().padStart(2, '0')}:00`
    }
  }

  // "บ่ายโมง" = 13:00
  if (/บ่ายโมง/.test(text)) return '13:00'

  // "บ่าย X" (บ่าย 1 = 13:00, บ่าย 2 = 14:00, ... บ่าย 5 = 17:00)
  const baiMatch = text.match(/บ่าย\s*(\d{1})\s*(ครึ่ง)?/)
  if (baiMatch) {
    const hour = parseInt(baiMatch[1]) + 12
    const half = baiMatch[2] ? '30' : '00'
    if (hour >= 13 && hour <= 17) {
      return `${hour}:${half}`
    }
  }

  // "X ทุ่ม" ด้วยตัวเลข (1 ทุ่ม = 19:00, ... 5 ทุ่ม = 23:00)
  const toomNumMatch = text.match(/(\d{1})\s*ทุ่ม/)
  if (toomNumMatch) {
    const hour = parseInt(toomNumMatch[1]) + 18
    if (hour >= 19 && hour <= 23) {
      return `${hour}:00`
    }
  }

  // "X ทุ่ม" ด้วยคำไทย (หนึ่งทุ่ม, สองทุ่ม, ...)
  const thaiToomMap: Record<string, number> = {
    'หนึ่งทุ่ม': 19, 'สองทุ่ม': 20, 'สามทุ่ม': 21,
    'สี่ทุ่ม': 22, 'ห้าทุ่ม': 23,
  }
  for (const [thaiHour, hour] of Object.entries(thaiToomMap)) {
    if (text.includes(thaiHour)) {
      return `${hour}:00`
    }
  }

  // "X โมง (ครึ่ง / Y นาที)" + บ่าย/เย็น/เช้า (รองรับ "5โมง" ไม่มี space)
  const hourMatch = text.match(/(\d{1,2})\s*โมง\s*(ครึ่ง)?(?:\s*(\d{1,2})\s*นาที)?/)
  if (hourMatch) {
    let hour = parseInt(hourMatch[1])
    let minute = 0

    if (hourMatch[2]) {
      minute = 30  // "ครึ่ง"
    } else if (hourMatch[3]) {
      minute = parseInt(hourMatch[3])  // "X นาที"
    }

    // บ่าย/เย็น → +12
    if (hour >= 1 && hour <= 6) {
      if (text.includes('บ่าย') || text.includes('เย็น')) {
        hour += 12
      }
    }

    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  }

  // คำกว้างๆ ที่ไม่ระบุเวลาชัด (ใช้เป็น default)
  if (text.includes('เช้ามืด')) return '05:00'

  return undefined
}

/**
 * แปลง Date เป็น YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * แปลงวันที่ ISO เป็นภาษาไทยที่อ่านง่าย
 */
export function formatThaiDate(isoDate: string): string {
  const date = new Date(isoDate)
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear() + 543 // พ.ศ.

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ]

  return `${day} ${thaiMonths[month]} ${year}`
}

/**
 * แปลงเวลา 24 ชม. เป็นภาษาไทย
 */
export function formatThaiTime(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':')
  const hour = parseInt(hourStr)
  const minute = parseInt(minuteStr)

  if (hour < 12) {
    return `${hour} น.`
  } else if (hour === 12) {
    return `เที่ยง`
  } else {
    return `${hour} น.`
  }
}
