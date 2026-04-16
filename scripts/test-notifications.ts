// ทดสอบ template ทั้งหมดแบบ standalone (ไม่ต้อง Supabase)

const MONTHS_TH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const DAYS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

function formatThaiDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(d)} ${MONTHS_TH_SHORT[parseInt(m) - 1]}`
}

// ===== 1. สรุปประจำวัน (มีข้อมูลครบ) =====
console.log('\n' + '='.repeat(50))
console.log('📋 TEST 1: สรุปประจำวัน (มีข้อมูลครบ)')
console.log('='.repeat(50))

const today = '2026-04-16'
const dateLabel = formatThaiDate(today)
const dayName = DAYS_TH[new Date('2026-04-16').getDay()]

let msg1 = `━━━━━━━━━━━━━━━━━━\n`
msg1 += `🌅 สรุปประจำวัน\n`
msg1 += `📆 วัน${dayName}ที่ ${dateLabel}\n`
msg1 += `━━━━━━━━━━━━━━━━━━\n`

// กิจวัตรประจำวัน
msg1 += `\n⏰ กิจวัตรประจำวัน (2 รายการ)\n`
msg1 += `1. Shopee\n`
msg1 += `   🕐 เวลา 12:00 น.\n`
msg1 += `   📝 กด coin ที่ candy, กดติดตาม, กดที่ coin ที่ pet\n`
msg1 += `2. ทิ้งขยะประจำสัปดาห์\n`
msg1 += `   🕐 เวลา 23:30 น.\n`
msg1 += `   📝 อย่าลืมเอาทิชชู่บนบ้านในถังลงมาด้วย\n`

// กิจวัตรรายเดือน
msg1 += `\n📅 กิจวัตรรายเดือน (1 รายการ)\n`
msg1 += `1. จ่ายค่าบ้าน\n`
msg1 += `   🕐 เวลา 22:00 น. (ทุกวันที่ 16)\n`
msg1 += `   📝 โอนผ่าน SCB\n`

// นัดหมาย
msg1 += `\n📌 นัดหมายวันนี้ (2 รายการ)\n`
msg1 += `1. หมอฟัน\n`
msg1 += `   🕐 เวลา 10:00 น.\n`
msg1 += `   📍 โรงพยาบาลกรุงเทพ\n`
msg1 += `   ⚡ ความสำคัญ: สูง\n`
msg1 += `   📝 นัดทำฟัน\n`
msg1 += `2. ประชุมทีม\n`
msg1 += `   🕐 เวลา 14:00 น.\n`
msg1 += `   📍 ออฟฟิศ\n`
msg1 += `   ⚡ ความสำคัญ: ปานกลาง\n`

// งานวันนี้
msg1 += `\n📋 งานวันนี้ (2 รายการ)\n`
msg1 += `1. ซื้อยูนิโคล่ แอร์ลิซึ่ม\n`
msg1 += `   🕐 กำหนด 18:00 น.\n`
msg1 += `2. ส่งรายงาน\n`
msg1 += `   🕐 กำหนด 17:00 น.\n`
msg1 += `   ⚡ ความสำคัญ: สูง\n`
msg1 += `   📝 ส่งให้หัวหน้า\n`

// บันทึกล่าสุด
msg1 += `\n🗒️ บันทึกล่าสุด (1 รายการ)\n`
msg1 += `1. รหัส WiFi [ทั่วไป]\n`

// งานค้างรวม
msg1 += `\n⚠️ งานค้างรวมทั้งหมด: 5 รายการ`

// พรุ่งนี้
msg1 += `\n\n🔜 พรุ่งนี้ (2 รายการ)\n`
msg1 += `1. 📌 นัดช่างแอร์\n`
msg1 += `   🕐 เวลา 09:00 น.\n`
msg1 += `   📍 บ้าน\n`
msg1 += `2. ⏰ Shopee\n`
msg1 += `   🕐 เวลา 12:00 น.\n`

msg1 += `\n━━━━━━━━━━━━━━━━━━\nขอให้เป็นวันที่ดีนะคะ! 💪`
console.log(msg1)

// ===== 2. สรุปประจำวัน (วันว่าง) =====
console.log('\n' + '='.repeat(50))
console.log('📋 TEST 2: สรุปประจำวัน (วันว่าง)')
console.log('='.repeat(50))

let msg2 = `━━━━━━━━━━━━━━━━━━\n`
msg2 += `🌅 สรุปประจำวัน\n`
msg2 += `📆 วัน${dayName}ที่ ${dateLabel}\n`
msg2 += `━━━━━━━━━━━━━━━━━━\n`
msg2 += `\n✨ วันนี้ว่างๆ ไม่มีนัด ไม่มีงาน`
msg2 += `\n\n📝 งานค้างรวม 2 รายการ`
msg2 += `\n\nขอให้เป็นวันที่ดีนะคะ! 💪`
console.log(msg2)

// ===== 3. แจ้งเตือนล่วงหน้า 1 ชม. =====
console.log('\n' + '='.repeat(50))
console.log('📋 TEST 3: แจ้งเตือนล่วงหน้า 1 ชม.')
console.log('='.repeat(50))

let msg3 = `━━━━━━━━━━━━━━━━━━\n`
msg3 += `🔔 แจ้งเตือนล่วงหน้า 1 ชม.\n`
msg3 += `━━━━━━━━━━━━━━━━━━\n`
msg3 += `\n📌 นัดหมาย\n`
msg3 += `1. หมอฟัน\n`
msg3 += `   🕐 เวลา 10:00 น.\n`
msg3 += `   📍 โรงพยาบาลกรุงเทพ\n`
msg3 += `\n📋 งาน\n`
msg3 += `2. ส่งรายงาน\n`
msg3 += `   🕐 10:30 น.\n`
msg3 += `\n⏰ กิจวัตร\n`
msg3 += `3. Shopee\n`
msg3 += `   🕐 เวลา 10:00 น.\n`
msg3 += `\n📅 กิจวัตรรายเดือน\n`
msg3 += `4. จ่ายค่าบ้าน\n`
msg3 += `   🕐 เวลา 10:00 น.\n`
console.log(msg3)

// ===== 4. Routine reminder (1 อัน) =====
console.log('\n' + '='.repeat(50))
console.log('📋 TEST 4: Routine reminder (1 อัน)')
console.log('='.repeat(50))

let msg4 = `⏰ กิจวัตรประจำสัปดาห์\n`
msg4 += `━━━━━━━━━━━━━━━━━━\n`
msg4 += `📌 Shopee\n`
msg4 += `🕐 เวลา 12:00 น.\n`
msg4 += `📝 กด coin ที่ candy, กดติดตาม, กดที่ coin ที่ pet\n`
msg4 += `━━━━━━━━━━━━━━━━━━`
console.log(msg4)

// ===== 5. Routine reminder (เตือนก่อน 15 นาที) =====
console.log('\n' + '='.repeat(50))
console.log('📋 TEST 5: Routine reminder (เตือนก่อน 15 นาที)')
console.log('='.repeat(50))

let msg5a = `⏰ กิจวัตรประจำสัปดาห์ (อีก 15 นาที)\n`
msg5a += `━━━━━━━━━━━━━━━━━━\n`
msg5a += `📌 ออกกำลังกาย\n`
msg5a += `🕐 เวลา 18:00 น.\n`
msg5a += `📝 วิ่ง 5 กม.\n`
msg5a += `━━━━━━━━━━━━━━━━━━`
console.log(msg5a)

// ===== 6. Monthly routine reminder =====
console.log('\n' + '='.repeat(50))
console.log('📋 TEST 6: Monthly routine reminder')
console.log('='.repeat(50))

let msg6 = `📅 กิจวัตรรายเดือน (อีก 30 นาที)\n`
msg6 += `━━━━━━━━━━━━━━━━━━\n`
msg6 += `📌 จ่ายค่าบ้าน\n`
msg6 += `🕐 เวลา 22:00 น. (ทุกวันที่ 31)\n`
msg6 += `📝 โอนผ่าน SCB\n`
msg6 += `━━━━━━━━━━━━━━━━━━`
console.log(msg6)

// ===== 7. Event reminder =====
console.log('\n' + '='.repeat(50))
console.log('📋 TEST 7: Event reminder')
console.log('='.repeat(50))

let msg7 = `🔔 อีก 1 ชั่วโมง!\n`
msg7 += `━━━━━━━━━━━━━━━━━━\n`
msg7 += `📌 หมอฟัน\n`
msg7 += `📆 16 เม.ย. 🕐 10:00 น.\n`
msg7 += `📍 โรงพยาบาลกรุงเทพ\n`
msg7 += `📝 นัดทำฟัน\n`
msg7 += `━━━━━━━━━━━━━━━━━━`
console.log(msg7)

// ===== 8. Task reminder =====
console.log('\n' + '='.repeat(50))
console.log('📋 TEST 8: Task reminder')
console.log('='.repeat(50))

let msg8 = `🔔 อีก 1 ชั่วโมง!\n`
msg8 += `━━━━━━━━━━━━━━━━━━\n`
msg8 += `📋 ส่งรายงาน\n`
msg8 += `📆 16 เม.ย. 🕐 17:00 น.\n`
msg8 += `📝 ส่งให้หัวหน้า\n`
msg8 += `━━━━━━━━━━━━━━━━━━`
console.log(msg8)

// ===== 9. Combined routines =====
console.log('\n' + '='.repeat(50))
console.log('📋 TEST 9: Combined routines (หลายอันพร้อมกัน)')
console.log('='.repeat(50))

let msg9 = `━━━━━━━━━━━━━━━━━━\n`
msg9 += `⏰ กิจวัตรที่ต้องทำ!\n`
msg9 += `━━━━━━━━━━━━━━━━━━\n`
msg9 += `\n1. ⏰ Shopee\n`
msg9 += `   🕐 เวลา 12:00 น.\n`
msg9 += `   📝 กด coin ที่ candy\n`
msg9 += `\n2. 📅 จ่ายค่าบ้าน\n`
msg9 += `   🕐 เวลา 22:00 น. (ทุกวันที่ 31)\n`
msg9 += `   📝 โอนผ่าน SCB\n`
msg9 += `\n3. ⏰ ทิ้งขยะ\n`
msg9 += `   🕐 เวลา 23:30 น.\n`
console.log(msg9)

// ===== 10. สรุปรายสัปดาห์ =====
console.log('\n' + '='.repeat(50))
console.log('📋 TEST 10: สรุปรายสัปดาห์')
console.log('='.repeat(50))

let msg10 = `━━━━━━━━━━━━━━━━━━\n`
msg10 += `📊 สรุปรายสัปดาห์\n`
msg10 += `📆 7 เม.ย. — 13 เม.ย.\n`
msg10 += `━━━━━━━━━━━━━━━━━━\n`
msg10 += `\n📌 นัดหมาย (2 รายการ)\n`
msg10 += `1. หมอฟัน\n`
msg10 += `   📆 9 เม.ย. 🕐 10:00 น.\n`
msg10 += `2. ประชุมทีม\n`
msg10 += `   📆 11 เม.ย. 🕐 14:00 น.\n`
msg10 += `\n✅ ทำเสร็จแล้ว (2 รายการ)\n`
msg10 += `1. ส่งรายงาน\n`
msg10 += `2. ซื้อของ\n`
msg10 += `\n📝 งานค้าง (1 รายการ)\n`
msg10 += `1. ซื้อยูนิโคล่ แอร์ลิซึ่ม\n`
msg10 += `   📆 12 เม.ย.\n`
msg10 += `\n🔜 สัปดาห์หน้า (1 นัด)\n`
msg10 += `1. นัดช่างแอร์\n`
msg10 += `   📆 15 เม.ย. 🕐 09:00 น.\n`
msg10 += `\n━━━━━━━━━━━━━━━━━━\nสู้ๆ สัปดาห์หน้านะคะ! 💪`
console.log(msg10)

console.log('\n' + '='.repeat(50))
console.log('✅ ทดสอบ template ทั้งหมด 10 แบบเสร็จสิ้น!')
console.log('='.repeat(50) + '\n')
