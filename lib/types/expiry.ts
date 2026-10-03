/**
 * ชนิดข้อมูลของฟีเจอร์ของหมดอายุ
 *
 * วันที่ทุกตัวเก็บเป็น ค.ศ. (ตรงกับ DB) แปลงเป็น พ.ศ. ตอนแสดงผลเท่านั้น
 */

/** หมวดของ — กำหนดตายตัว ตรงกับ CHECK constraint ในตาราง */
export type ExpiryCategory =
  | 'food'
  | 'medicine'
  | 'cosmetic'
  | 'document'
  | 'household'
  | 'other'

/** ป้ายและไอคอนของแต่ละหมวด — รวมไว้ที่เดียวให้ฟอร์มกับหน้ารายการใช้ร่วมกัน */
export const CATEGORY_META: Record<ExpiryCategory, { label: string; icon: string }> = {
  food: { label: 'อาหาร', icon: '🥗' },
  medicine: { label: 'ยา', icon: '💊' },
  cosmetic: { label: 'เครื่องสำอาง', icon: '💄' },
  document: { label: 'เอกสาร', icon: '📄' },
  household: { label: 'ของใช้', icon: '🧴' },
  other: { label: 'อื่น ๆ', icon: '📦' },
}

/** ลำดับหมวดที่ใช้แสดงในปุ่มกรองและ dropdown */
export const CATEGORY_ORDER: ExpiryCategory[] = [
  'food',
  'medicine',
  'cosmetic',
  'document',
  'household',
  'other',
]

/** เก็บของที่หมดอายุแล้วไว้อีกกี่วันก่อนลบทิ้ง */
export const KEEP_AFTER_EXPIRY_DAYS = 30

/** ของ 1 ชิ้น */
export interface ExpiryItem {
  id: string
  name: string
  category: ExpiryCategory
  /** วันที่ซื้อ — ไม่บังคับ บางอย่างจำไม่ได้ */
  purchasedOn: string | null
  /** วันหมดอายุ YYYY-MM-DD */
  expiresOn: string
  /** เตือนล่วงหน้ากี่วัน (0 = ไม่เตือน) */
  remindBeforeDays: number
  note: string | null
}

/** สถานะของตามวันหมดอายุ — ใช้จัดกลุ่มและเลือกสี */
export type ExpiryStatus = 'expired' | 'soon' | 'fresh'

/** ของ 1 ชิ้นพร้อมสถานะที่คำนวณแล้ว */
export interface ExpiryItemView extends ExpiryItem {
  status: ExpiryStatus
  /** เหลืออีกกี่วันถึงวันหมดอายุ (ติดลบ = เลยมาแล้ว) */
  daysLeft: number
  /** เหลืออีกกี่วันก่อนถูกลบอัตโนมัติ — มีค่าเฉพาะของที่หมดอายุแล้ว */
  daysUntilRemoved: number | null
}
