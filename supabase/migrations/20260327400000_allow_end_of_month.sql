-- อนุญาตค่า 32 = สิ้นเดือน (วันสุดท้ายของแต่ละเดือน)
-- Cron จะ match day_of_month = 32 เมื่อวันนี้เป็นวันสุดท้ายของเดือน

ALTER TABLE monthly_routines DROP CONSTRAINT IF EXISTS monthly_routines_day_of_month_check;
ALTER TABLE monthly_routines ADD CONSTRAINT monthly_routines_day_of_month_check CHECK (day_of_month >= 1 AND day_of_month <= 32);
