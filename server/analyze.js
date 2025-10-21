// server/analyze.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.post("/analyze", async (req, res) => {
  try {
    const text = String(req.body?.text || "").slice(0, 12000);
    if (!text.trim()) {
      return res.status(400).json({ success: false, error: "No resume text provided" });
    }

    console.log("✅ Sending request to Gemini (v1)...");

    // ✅ OFFICIAL v1 CALL — this is the key fix
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text }] }]
    });

    const raw = result.response.text();
    console.log("✅ Gemini responded:", raw);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const s = raw.indexOf("{");
      const eIdx = raw.lastIndexOf("}");
      if (s >= 0 && eIdx > s) parsed = JSON.parse(raw.slice(s, eIdx + 1));
      else throw e;
    }

    return res.json({ success: true, data: parsed });

  } catch (err) {
    console.error("Gemini analyze error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Internal server error"
    });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`✅ Gemini backend (v1) running at http://localhost:${PORT}`));

