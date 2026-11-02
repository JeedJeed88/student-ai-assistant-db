# Student AI Assistant — เวอร์ชันปรับปรุง

โปรเจกต์เว็บถาม-ตอบสำหรับนักเรียน ใช้ Cloudflare Workers เสิร์ฟหน้าเว็บและ API, Cloudflare D1 เก็บ FAQ และ Gemini API ช่วยเรียบเรียงคำตอบ (ถ้าไม่ตั้ง Gemini ระบบยังตอบจาก FAQ ได้)

## ชื่อที่ใช้ในโปรเจกต์
- GitHub Repository: `student-ai-assistant-db`
- Cloudflare D1: `student-ai-assistant-db`
- Worker: `student-ai-assistant-db-api`

## 1) เตรียม Cloudflare D1
1. เข้า https://dash.cloudflare.com/
2. ไปที่ **Workers & Pages > D1 SQL Database > Create database**
3. ตั้งชื่อ `student-ai-assistant-db`
4. คัดลอก **Database ID**
5. เปิด `wrangler.jsonc` แล้วแทนค่า `REPLACE_WITH_YOUR_D1_DATABASE_ID` ด้วย Database ID จริง
6. Commit การแก้ไขขึ้น GitHub

## 2) สร้างตารางและข้อมูลเริ่มต้น (ทำครั้งเดียว)
แนะนำให้ใช้ Wrangler จากคอมพิวเตอร์:
1. ติดตั้ง Node.js รุ่น LTS จาก https://nodejs.org/
2. แตก ZIP แล้วเปิด Terminal/Command Prompt ในโฟลเดอร์โปรเจกต์ (โฟลเดอร์ที่มี `package.json`)
3. รัน:
   ```bash
   npm install
   npx wrangler login
   npm run db:apply
   ```
4. อนุญาต Wrangler เข้าถึงบัญชี Cloudflare แล้วรอจนคำสั่งสำเร็จ

คำสั่ง `db:apply` จะใช้ไฟล์ `migrations/0001_initial.sql` สร้างตารางและ FAQ ตัวอย่าง โดย Wrangler จะจดจำ migration ที่รันแล้ว ไม่ควรรัน SQL ชุดเดียวกันด้วย Console ซ้ำอีก

**ถ้าไม่สะดวกใช้ Terminal:** เปิด D1 > เลือกฐานข้อมูล > Console แล้วรันเนื้อหาจาก `migrations/0001_initial.sql` ได้ แต่ให้เลือกวิธีใดวิธีหนึ่งเท่านั้น และอย่ารันซ้ำ

## 3) Deploy Worker
วิธีง่ายสำหรับมือใหม่:
1. อัปโหลดไฟล์ทั้งหมดใน ZIP ไปยัง GitHub Repository `student-ai-assistant-db` (อัปโหลดเนื้อหาข้างใน ไม่ใช่ ZIP)
2. Cloudflare Dashboard > **Workers & Pages > Create application**
3. เลือกเชื่อม GitHub แล้วเลือก Repository `student-ai-assistant-db`
4. ตั้งชื่อ Worker เป็น `student-ai-assistant-db-api`
5. ถ้ามีช่อง Root directory ให้ใช้ `/`
6. ใช้คำสั่ง Deploy: `npx wrangler deploy`
7. ตรวจสอบว่า Build/Deploy สำเร็จ

ถ้า Cloudflare แจ้งว่าไม่มีสิทธิ์ deploy ให้ตรวจสอบ Cloudflare API token และสิทธิ์ GitHub Repository ที่เชื่อมไว้

## 4) ตั้งค่า Secrets (จำเป็นสำหรับหน้า Admin และ AI)
เข้า Worker `student-ai-assistant-db-api` > **Settings > Variables and Secrets** แล้วเพิ่ม:
- `ADMIN_PASSWORD` เป็น **Secret**: ตั้งรหัสผ่านผู้ดูแลที่เดายาก
- `GEMINI_API_KEY` เป็น **Secret**: API key จาก https://aistudio.google.com/apikey (ไม่บังคับ ถ้าไม่ใส่ระบบจะตอบจาก FAQ ตรง ๆ)

ห้ามใส่ค่าจริงของ Secret ลง GitHub หรือส่งให้ผู้อื่น

## 5) ทดสอบ
แทน `ชื่อ-worker.ชื่อบัญชี.workers.dev` ด้วย URL ที่ Cloudflare แสดง:
- ตรวจ API: `https://ชื่อ-worker.ชื่อบัญชี.workers.dev/api/health`
  ควรได้ JSON ที่มี `"ok":true` และ `"database":"connected"`
- หน้าแชต: `https://ชื่อ-worker.ชื่อบัญชี.workers.dev/`
- หน้า Admin: `https://ชื่อ-worker.ชื่อบัญชี.workers.dev/admin.html`

ล็อกอิน Admin ด้วยค่า `ADMIN_PASSWORD` ที่ตั้งไว้ใน Secrets

## 6) การใช้งาน
- เพิ่ม/ลบคำถาม-คำตอบได้จากหน้า `/admin.html`
- หน้าแชตค้นจากคำถาม คำตอบ และ keywords ใน D1
- Gemini เป็นตัวช่วยเรียบเรียงจากข้อมูล FAQ ที่ค้นเจอเท่านั้น; ถ้าไม่พบข้อมูลให้แจ้งผู้ใช้ ไม่ควรใช้แทนข้อมูลประกาศจริงของวิทยาลัย
- เปลี่ยน FAQ ตัวอย่างเป็นข้อมูลจริงก่อนเปิดให้ผู้เรียนใช้

## แก้ปัญหาเบื้องต้น
- `D1 binding DB is missing`: ตรวจ `wrangler.jsonc` ว่ามี binding ชื่อ `DB` และ Database ID ถูกต้อง แล้ว Deploy ใหม่
- `ADMIN_PASSWORD` ยังไม่ได้ตั้งค่า: เพิ่ม Secret ชื่อนี้ใน Worker Settings
- `Database not found`: ตรวจ Database ID และชื่อ D1 ใน `wrangler.jsonc`
- หน้าเว็บขึ้นแต่แชตใช้ไม่ได้: เปิด `/api/health` ก่อน ถ้าไม่ผ่านให้แก้ D1 binding ก่อน
- เปลี่ยนโค้ดแล้วไม่อัปเดต: ตรวจว่า Commit ขึ้น branch ที่ Cloudflare เชื่อมอยู่ และดู Deploy ล่าสุดใน Cloudflare

## ข้อจำกัดและความปลอดภัย
นี่เป็นต้นแบบสำหรับเริ่มต้น ไม่ใช่ระบบ production ที่ผ่านการตรวจสอบความปลอดภัยเต็มรูปแบบ หน้าผู้ดูแลใช้รหัสผ่านร่วม (shared password) และ API มี CORS แบบเปิดเพื่อให้ทดสอบง่าย ก่อนเปิดใช้งานสาธารณะควรจำกัด CORS, เพิ่ม rate limiting/Turnstile และใช้ระบบยืนยันตัวตนผู้ดูแลที่แข็งแรงขึ้น
