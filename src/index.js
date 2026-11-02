const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", ...cors }
});

async function adminAuth(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD ใน Cloudflare Secrets" }, 503);
  }
  if (request.headers.get("Authorization") !== `Bearer ${env.ADMIN_PASSWORD}`) {
    return json({ error: "รหัสผ่านผู้ดูแลไม่ถูกต้อง" }, 401);
  }
  return null;
}

function cleanText(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

async function findKnowledge(env, message) {
  // Match the complete Thai phrase first. Thai text often has no spaces between words.
  const phrase = `%${message}%`;
  const exact = await env.DB.prepare(`
    SELECT id, category, question, answer, keywords
    FROM knowledge
    WHERE question LIKE ? OR answer LIKE ? OR keywords LIKE ?
    ORDER BY id DESC LIMIT 6
  `).bind(phrase, phrase, phrase).all();

  if (exact.results?.length) return exact.results;

  // Also try individual terms when the user separates words with spaces.
  const terms = [...new Set(message.split(/[\s,，。!?！？、]+/).map(x => x.trim()).filter(x => x.length >= 2))].slice(0, 8);
  if (!terms.length) return [];

  const clauses = terms.map(() => "(question LIKE ? OR answer LIKE ? OR keywords LIKE ?)");
  const params = [];
  for (const term of terms) params.push(`%${term}%`, `%${term}%`, `%${term}%`);

  const result = await env.DB.prepare(`
    SELECT id, category, question, answer, keywords
    FROM knowledge
    WHERE ${clauses.join(" OR ")}
    ORDER BY id DESC LIMIT 6
  `).bind(...params).all();
  return result.results || [];
}

async function chat(request, env) {
  const body = await request.json().catch(() => ({}));
  const message = cleanText(body.message, 1000);
  if (!message) return json({ error: "กรุณาพิมพ์คำถาม" }, 400);
  if (!env.DB) return json({ error: "ยังไม่ได้เชื่อมต่อฐานข้อมูล D1 (binding: DB)" }, 503);

  const rows = await findKnowledge(env, message);
  const knowledge = rows.map((r, i) =>
    `${i + 1}. หมวด: ${r.category}\nคำถาม: ${r.question}\nคำตอบ: ${r.answer}`
  ).join("\n\n");

  if (!env.GEMINI_API_KEY) {
    if (rows.length) return json({ answer: rows[0].answer, source: "knowledge-base" });
    return json({
      answer: "ยังไม่พบคำตอบที่ตรงกับคำถามในฐานข้อมูล กรุณาลองใช้คำถามอื่น หรือติดต่อเจ้าหน้าที่ของวิทยาลัย",
      source: "fallback"
    });
  }

  const prompt = `คุณคือผู้ช่วยตอบคำถามนักเรียนของวิทยาลัย ตอบเป็นภาษาไทย สุภาพ กระชับ และยึดข้อมูลจากฐานความรู้ด้านล่างเท่านั้น ห้ามแต่งข้อมูลวันเวลา ราคา เบอร์โทร หรือกำหนดการ หากข้อมูลไม่เพียงพอ ให้แจ้งว่าไม่พบข้อมูลและแนะนำให้ติดต่อเจ้าหน้าที่

ฐานความรู้:
${knowledge || "ไม่พบข้อมูลที่เกี่ยวข้อง"}

คำถาม: ${message}

ตอบโดยใช้เฉพาะข้อมูลที่มี`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 }
      })
    }
  );

  if (!response.ok) {
    console.error("Gemini API returned", response.status);
    if (rows.length) return json({ answer: rows[0].answer, source: "knowledge-base-fallback" });
    return json({
      answer: "ขณะนี้ระบบ AI ติดต่อไม่ได้ แต่ระบบฐานความรู้ยังพร้อมใช้งาน กรุณาลองใหม่ภายหลัง",
      source: "fallback"
    }, 200);
  }

  const data = await response.json().catch(() => ({}));
  const answer = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
  if (!answer) {
    if (rows.length) return json({ answer: rows[0].answer, source: "knowledge-base-fallback" });
    return json({ answer: "ยังไม่พบข้อมูลที่เพียงพอ กรุณาติดต่อเจ้าหน้าที่", source: "fallback" });
  }
  return json({ answer, source: "gemini" });
}

async function adminApi(request, env, url) {
  const denied = await adminAuth(request, env);
  if (denied) return denied;
  if (!env.DB) return json({ error: "ยังไม่ได้เชื่อมต่อฐานข้อมูล D1 (binding: DB)" }, 503);

  if (request.method === "GET") {
    const result = await env.DB.prepare(
      "SELECT id, category, question, answer, keywords FROM knowledge ORDER BY id DESC"
    ).all();
    return json({ items: result.results || [] });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const category = cleanText(body.category || "ทั่วไป", 80);
    const question = cleanText(body.question, 500);
    const answer = cleanText(body.answer, 3000);
    const keywords = cleanText(body.keywords, 500);
    if (!question || !answer) return json({ error: "กรุณากรอกคำถามและคำตอบ" }, 400);

    await env.DB.prepare(
      "INSERT INTO knowledge (category, question, answer, keywords) VALUES (?, ?, ?, ?)"
    ).bind(category || "ทั่วไป", question, answer, keywords).run();
    return json({ ok: true });
  }

  if (request.method === "DELETE") {
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return json({ error: "รหัสข้อมูลไม่ถูกต้อง" }, 400);
    await env.DB.prepare("DELETE FROM knowledge WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      if (url.pathname === "/api/health") {
        if (!env.DB) return json({ ok: false, error: "D1 binding DB is missing" }, 503);
        await env.DB.prepare("SELECT 1").first();
        return json({ ok: true, service: "student-ai-assistant", database: "connected" });
      }
      if (url.pathname === "/api/chat" && request.method === "POST") return await chat(request, env);
      if (url.pathname.startsWith("/api/admin/")) return await adminApi(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Worker error:", error);
      return json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาตรวจสอบการตั้งค่า D1 และลองใหม่" }, 500);
    }
  }
};
