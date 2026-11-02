CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'ทั่วไป',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);

-- Seed records are guarded so re-running this SQL will not duplicate them.
INSERT INTO knowledge (category, question, answer, keywords)
SELECT 'ตารางเรียน', 'ดูตารางเรียนได้ที่ไหน',
       'นักเรียนสามารถตรวจสอบตารางเรียนได้จากงานทะเบียนหรือประกาศของวิทยาลัย กรุณาระบุระดับชั้นและสาขาเพื่อให้เจ้าหน้าที่ช่วยตรวจสอบข้อมูลล่าสุด',
       'ตารางเรียน ตารางสอน เรียน'
WHERE NOT EXISTS (
  SELECT 1 FROM knowledge WHERE question = 'ดูตารางเรียนได้ที่ไหน'
);

INSERT INTO knowledge (category, question, answer, keywords)
SELECT 'ค่าเล่าเรียน', 'สอบถามค่าเทอม',
       'ค่าเล่าเรียนขึ้นอยู่กับระดับชั้นและสาขาวิชา กรุณาติดต่อฝ่ายการเงินหรือแจ้งสาขาและระดับชั้นเพื่อให้เจ้าหน้าที่ตรวจสอบยอดที่ถูกต้อง',
       'ค่าเทอม ค่าเล่าเรียน ค่าบำรุง'
WHERE NOT EXISTS (
  SELECT 1 FROM knowledge WHERE question = 'สอบถามค่าเทอม'
);

INSERT INTO knowledge (category, question, answer, keywords)
SELECT 'ติดต่อวิทยาลัย', 'ช่องทางติดต่อวิทยาลัย',
       'กรุณาเพิ่มเบอร์โทรศัพท์ อีเมล และช่องทางติดต่อจริงของวิทยาลัยในหน้าจัดการข้อมูลก่อนเปิดใช้งาน',
       'ติดต่อ เบอร์โทร อีเมล'
WHERE NOT EXISTS (
  SELECT 1 FROM knowledge WHERE question = 'ช่องทางติดต่อวิทยาลัย'
);
