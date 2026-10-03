/**
 * ตรวจว่า PDF ล็อกรหัสไว้ไหม
 *
 * ไฟล์นี้ตั้งใจให้ไม่ import อะไรเลย เพื่อให้เรียกได้ทั้งจากเบราว์เซอร์
 * (ตอนผู้ใช้เลือกไฟล์) และจากฝั่ง server — ถ้าเผลอ import โมดูลฝั่ง server
 * เข้ามา client component จะพังทันทีเพราะดึง Gemini SDK ติดไปด้วย
 */

/** ลำดับไบต์ของคำว่า "/Encrypt" ใน PDF */
const ENCRYPT_MARKER = [0x2f, 0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74] // "/Encrypt"

/** อ่านท้ายไฟล์เท่านี้ก็พอ — trailer ของ PDF อยู่ตรงนั้น */
export const PDF_TAIL_BYTES = 8192

/**
 * ไบต์ชุดนี้มี /Encrypt อยู่ไหม
 *
 * ตรวจจากท้ายไฟล์เท่านั้น (ที่ trailer อยู่) แทนที่จะไล่ทั้งไฟล์
 * ลดโอกาสเจอคำนี้ที่บังเอิญอยู่ใน content stream แล้วเข้าใจผิดว่าล็อก
 */
export function isEncryptedPdfBytes(bytes: Uint8Array): boolean {
  const marker = ENCRYPT_MARKER
  const limit = bytes.length - marker.length

  for (let i = 0; i <= limit; i++) {
    let matched = true
    for (let j = 0; j < marker.length; j++) {
      if (bytes[i + j] !== marker[j]) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}

/**
 * ไฟล์ที่ผู้ใช้เลือกเป็น PDF ที่ล็อกรหัสไหม — ใช้ในเบราว์เซอร์
 *
 * อ่านแค่ท้ายไฟล์ ไม่ได้โหลดทั้งไฟล์เข้าหน่วยความจำ
 * ถ้าอ่านไม่ได้ด้วยเหตุใดก็ตามจะคืน false แล้วปล่อยให้ฝั่ง server ตรวจซ้ำแทน
 */
export async function isEncryptedPdfFile(file: File): Promise<boolean> {
  if (file.type !== 'application/pdf') return false

  try {
    const tail = file.slice(Math.max(0, file.size - PDF_TAIL_BYTES))
    const bytes = new Uint8Array(await tail.arrayBuffer())
    return isEncryptedPdfBytes(bytes)
  } catch {
    // ตรวจไม่ได้ไม่ใช่เรื่องคอขาดบาดตาย — server ยังตรวจให้อีกชั้น
    return false
  }
}
