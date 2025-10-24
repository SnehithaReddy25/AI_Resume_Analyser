
import "dotenv/config";
// import express from "express";
// import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

// const app = express();
// app.use(cors());
// app.use(express.json({ limit: "8mb" }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Helper: extract JSON from raw string safely
function extractJSON(str) {
  const match = str.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Gemini response");
  return JSON.parse(match[0]);
}

// Helper: retry with exponential backoff
async function generateWithRetry(model, prompt, maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      return result;
    } catch (err) {
      if (err.message.includes("503") || err.message.includes("overloaded")) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`Service overloaded, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
      } else {
        throw err;
      }
    }
  }
  throw new Error("Gemini is overloaded after multiple retries");
}

/**
 * Vercel Serverless Handler Function
 * Vercel automatically maps this file (api/analyze.js) to the /api/analyze endpoint.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  // Vercel's handler provides req.body automatically for JSON POST requests.
  // We also need to manually handle the CORS response headers.

  // ⚠️ Add CORS headers manually since we removed the Express cors middleware
  res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle pre-flight CORS requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Ensure it's a POST request (optional but good practice)
  if (req.method !== 'POST') {
  res.status(405).json({ success: false, error: "Method Not Allowed" });
    return;
  }
    
  try {
    // Extract body safely. req.body is provided by Vercel for serverless functions.
    const text = String(req.body?.text || "").slice(0, 12000);
    const jobDescription = String(req.body?.jobDescription || "").slice(0, 8000);

    if (!text.trim()) {
      // Use Vercel's res.status().json() for response
      return res.status(400).json({ success: false, error: "No resume text provided" });
    }

// app.post("/analyze", async (req, res) => {
//   try {
//     const text = String(req.body?.text || "").slice(0, 12000);
//     const jobDescription = String(req.body?.jobDescription || "").slice(0, 8000);

//     if (!text.trim()) {
//       return res.status(400).json({ success: false, error: "No resume text provided" });
//     }

    const prompt = `
You are an ATS (Applicant Tracking System) and Resume Reviewer.

Analyze the following **resume** and **job description** and provide JSON only.

=======================
📌 Resume:
${text}

=======================
📌 Job Description:
${jobDescription || "Not provided"}

=======================
🎯 Generate JSON using EXACT format:

{
  "summary": "",
  "overallScore": 1-10,
  "strengths": [],
  "improvements": [],
  "keywords": [],
  "atsScore": 0-100,
  "matchedKeywords": [],
  "missingKeywords": [],
  "jobFitInsights": []
}

No extra words, no markdown, only raw JSON.
    `;

    console.log("✅ Sending request to Gemini (ATS + Resume Match)");

    const result = await generateWithRetry(model, prompt);
    const raw = result.response.text();
    console.log("✅ Gemini raw response received");

    let parsed;
    try {
      parsed = extractJSON(raw);
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", e, "\nRaw response:", raw);
      throw new Error("Invalid JSON received from Gemini");
    }

    // ✅ Return as 'analysis' to match frontend expectation
    return res.json({ success: true, analysis: parsed });

  } catch (err) {
    console.error("Gemini analyze error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// const PORT = process.env.PORT || 8787;
// app.listen(PORT, () =>
//   console.log(`✅ Backend running on http://localhost:${PORT}`)
// );
