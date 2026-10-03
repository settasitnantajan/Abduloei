-- ผู้ร่วมหารรายจ่าย — รายการหนึ่งหารกันได้หลายคน
--
-- เดิมเก็บ paid_by_member_id ไว้คอลัมน์เดียว = รายการเป็นของคนเดียวเท่านั้น
-- แต่จริง ๆ ค่าอาหาร/ของใช้ร่วมกันต้องหารกัน จึงแยกเป็นตารางความสัมพันธ์
--
-- วิธีหาร: หารเท่ากันตามจำนวนคนที่ร่วม (ไม่เก็บยอดรายคน คำนวณสดตอนแสดงผล)
-- เหตุผลเดียวกับงวดผ่อน — ถ้าแก้ยอดรายการทีหลัง ยอดที่หารจะถูกเองโดยไม่ต้องไล่อัปเดต
--
-- คอลัมน์ paid_by_member_id เดิมยังอยู่ ไม่ได้ลบ:
-- ความหมายเปลี่ยนเป็น "คนที่รูด/จ่ายออกไปก่อน" ซึ่งคนละเรื่องกับ "ใครร่วมหาร"

-- === ผู้ร่วมหารรายการใช้จ่าย (บัตร / เงินสด) ===
CREATE TABLE IF NOT EXISTS expense_shares (
  expense_id UUID NOT NULL REFERENCES finance_expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES home_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (expense_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_shares_expense ON expense_shares (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_member ON expense_shares (member_id);

-- === ผู้ร่วมหารงวดผ่อน ===
CREATE TABLE IF NOT EXISTS installment_shares (
  installment_id UUID NOT NULL REFERENCES finance_installments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES home_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (installment_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_installment_shares_installment ON installment_shares (installment_id);
CREATE INDEX IF NOT EXISTS idx_installment_shares_member ON installment_shares (member_id);

-- === ผู้ร่วมหารค่าใช้จ่ายประจำ (แม่แบบ) ===
CREATE TABLE IF NOT EXISTS recurring_shares (
  recurring_id UUID NOT NULL REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES home_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (recurring_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_recurring_shares_recurring ON recurring_shares (recurring_id);
CREATE INDEX IF NOT EXISTS idx_recurring_shares_member ON recurring_shares (member_id);


-- === ย้ายข้อมูลเดิม ===
-- รายการที่เคยระบุคนไว้ ให้คนนั้นเป็นผู้ร่วมหารคนเดียว (ยอดเท่าเดิม ไม่เปลี่ยนความหมาย)
-- รายการที่เป็น null (ไม่ระบุ) ปล่อยว่างไว้ = ยังไม่มีใครรับผิดชอบ
INSERT INTO expense_shares (expense_id, member_id)
SELECT id, paid_by_member_id FROM finance_expenses
WHERE paid_by_member_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO installment_shares (installment_id, member_id)
SELECT id, owner_member_id FROM finance_installments
WHERE owner_member_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO recurring_shares (recurring_id, member_id)
SELECT id, paid_by_member_id FROM recurring_expenses
WHERE paid_by_member_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- === RLS ===
-- ตารางนี้ไม่มี user_id ของตัวเอง จึงอ้างอิงเจ้าของผ่านรายการแม่
ALTER TABLE expense_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "es_all" ON expense_shares;
CREATE POLICY "es_all" ON expense_shares FOR ALL
  USING (EXISTS (
    SELECT 1 FROM finance_expenses e
    WHERE e.id = expense_shares.expense_id AND e.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM finance_expenses e
    WHERE e.id = expense_shares.expense_id AND e.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "is_all" ON installment_shares;
CREATE POLICY "is_all" ON installment_shares FOR ALL
  USING (EXISTS (
    SELECT 1 FROM finance_installments i
    WHERE i.id = installment_shares.installment_id AND i.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM finance_installments i
    WHERE i.id = installment_shares.installment_id AND i.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "rs_all" ON recurring_shares;
CREATE POLICY "rs_all" ON recurring_shares FOR ALL
  USING (EXISTS (
    SELECT 1 FROM recurring_expenses r
    WHERE r.id = recurring_shares.recurring_id AND r.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM recurring_expenses r
    WHERE r.id = recurring_shares.recurring_id AND r.user_id = auth.uid()
  ));
