//removing automatic analyser
import { useState, useEffect } from "react";
import constants, { buildPresenceChecklist, METRIC_CONFIG } from "../constants.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function App() {
  const [aiReady, setAiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [presenceChecklist, setPresenceChecklist] = useState([]);
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => setAiReady(true), []);

  const extractPDFText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const texts = await Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf.getPage(i + 1).then((page) =>
          page.getTextContent().then((tc) => tc.items.map((it) => it.str).join(" "))
        )
      )
    );
    return texts.join("\n").trim();
  };

  const analyzeResume = async (text) => {
    const prompt = constants.ANALYZE_RESUME_PROMPT.replace("{{DOCUMENT_TEXT}}", text);
    const resp = await fetch("http://localhost:8787/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: prompt,
        resumeText: text,
        jobDescription: jobDescription || "",
      }),
    });
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`;
      try {
        const e = await resp.json();
        msg = e?.error || msg;
      } catch {}
      throw new Error(msg);
    }
    const json = await resp.json();
    if (!json?.success) throw new Error(json?.error || "Unknown analysis error");
    return json.analysis;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") return alert("Please upload a PDF file only.");
    setUploadedFile(file);
    setIsLoading(true);
    setAnalysis(null);
    try {
      const text = await extractPDFText(file);
      setResumeText(text);
      setPresenceChecklist(buildPresenceChecklist(text));
    } catch (e) {
      console.error(e);
      alert("Error reading PDF: " + e.message);
      setResumeText("");
      setPresenceChecklist([]);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setUploadedFile(null);
    setResumeText("");
    setPresenceChecklist([]);
    setJobDescription("");
    setAnalysis(null);
  };

  return (
    <div className="min-h-screen bg-main-gradient p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      <div className="max-w-5xl mx-auto w-full">
        <div className="text-center mb-6">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light bg-gradient-to-r from-[#B8A9FF] via-[#9C8CFF] to-[#7A78FF] bg-clip-text text-transparent mb-2">
            RESUME ANALYZER
          </h1>
          <p className="text-slate-300 text-sm sm:text-base">Upload your resume and get instant AI feedback</p>
        </div>

        {/* Upload Resume */}
        {!uploadedFile && (
          <div className="upload-area">
            <div className="upload-zone">
              <div className="text-4xl sm:text-5xl lg:text-6xl mb-4">📄</div>
              <h3 className="text-xl sm:text-2xl text-slate-200 mb-2">Upload Your Resume</h3>
              <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">PDF FILES ONLY and get feedback</p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={!aiReady}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`inline-block btn-primary ${!aiReady ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Choose PDF FILE
              </label>
            </div>
          </div>
        )}

        {/* Job Description input & Analyze button */}
        {uploadedFile && !analysis && (
          <div className="mb-6 max-w-3xl mx-auto">
            <label className="text-slate-300 block mb-2 font-medium">Paste Job Description (Optional)</label>
            <textarea
              className="w-full p-3 rounded-lg bg-slate-800 text-white text-sm border border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
              rows="6"
              placeholder="Paste the job description here to calculate ATS match score..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            ></textarea>

            <div className="text-center mt-4">
              <button
                className="btn-primary"
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const result = await analyzeResume(resumeText);
                    setAnalysis(result);
                  } catch (e) {
                    console.error(e);
                    alert("Error analyzing resume: " + e.message);
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                Analyze Resume
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="p-6 sm:p-8 max-w-md mx-auto">
            <div className="text-center">
              <div className="loading-spinner"></div>
              <h3 className="text-lg sm:text-xl text-slate-200 mb-2">Analyzing your resume</h3>
              <p className="text-slate-400 text-sm sm:text-base">Please wait while AI reviews</p>
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && uploadedFile && (
          <div className="space-y-6 p-4 sm:px-8 lg:p-16">

            {/* File Info */}
            <div className="file-info-card">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex item-center gap4">
                  <div className="icon-container-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30">
                    <span className="text-3xl">📄</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-violet-400 mb-1">Analysis Completed</h3>
                    <p className="text-slate-300 text-sm break-all">{uploadedFile.name}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={reset} className="btn-secondary">New Analysis</button>
                </div>
              </div>
            </div>

            {/* Overall Score */}
              <div className="score-card">
                 <div className="text-center mb-6">
                   <div className=" flex items-center justify-center gap-3 mb-3">
                     <span className="text-2xl">🏆</span>
                     <h2 className="text-2xl sm:text-3xl font-bold text-white">
                       Overall Score
                     </h2>
                   </div>
                   <div className="relative">
                     <p
                       className="text-4xl sm:text-3xl font-extrabold
                                text-slate-100 drop-show-lg"
                     >
                       {analysis.overallScore || "0/10"}
                     </p>
                   </div>
                   <div
                     className={`inline-flex items-center 
                               gap-2 mt-3 px-4 py-2 
                              rounded-full ${
                                 parseInt(analysis.overallScore) >= 8
                                   ? "score-status-excellent"
                                   : parseInt(analysis.overallScore) >= 6
                                   ? "score-status-good"
                                   : "score-status-improvement"
                               }`}
                   >
                     <span className="text-lg">
                       {parseInt(analysis.overallScore) >= 8
                         ? "⭐️⭐️⭐️"
                         : parseInt(analysis.overallScore) >= 6
                         ? "⭐️⭐️"
                         : "📈"}
                     </span>
                     <span className="font-semibold text-lg  text-slate-200">
                       {parseInt(analysis.overallScore) >= 8
                         ? "Excellent"
                         : parseInt(analysis.overallScore) >= 6
                         ? "Good"
                         : "Need Improvement"}
                     </span>
                   </div>
                 </div>
                 <div className="progress-bar">
                   <div
                     className={`h-full rounded-full transitions-alll
                           duration-1000 ease-out shadow-sm ${
                             parseInt(analysis.overallScore) >= 8
                               ? "progress-excellent"
                               : parseInt(analysis.overallScore) >= 8
                               ? "progress-good"
                               : "progress-improvement"
                           }`}
                     style={{
                       width: `${
                         (parseInt(analysis.overallScore) / 10) * 100
                       }%`,
                     }}
                   ></div>
                 </div>
                 <p className="text-slate-300 text-sm mt-3 text-center font-medium">
                   Score based on quality of the content , keyword usage and
                   formatting
                 </p>
               </div>

                     

            {/* Strengths & Improvements */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="feature-card-violet group">
                <div className="bg-violet-500/20 icon-container-lg mx-auto mb-3 group-hover:bg-violet-400/30 transition-colors">
                  <span className="text-violet-400 text-xl">✅</span>
                </div>
                <h4 className="text-violet-300 text-sm font-semibold uppercase mb-3">Top Strengths</h4>
                <div className="space-y-2 text-left">
                  {(analysis.strengths || []).slice(0, 4).map((s, i) => (
                    <div key={i} className="list-item-violet">
                      <span className="text-violet-400 text-sm mt-0.5">▸</span>
                      <span className="text-slate-200 font-medium text-sm leading-relaxed">{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="feature-card-blue group">
                <div className="bg-blue-500/20 icon-container-lg mx-auto mb-3 group-hover:bg-green-400/30 transition-colors">
                  <span className="text-blue-300 text-xl">⚡</span>
                </div>
                <h4 className="text-blue-300 text-sm font-semibold uppercase mb-3">Improvements</h4>
                <div className="space-y-2 text-left">
                  {(analysis.improvements || []).slice(0, 4).map((imp, i) => (
                    <div key={i} className="list-item-blue">
                      <span className="text-blue-400 text-sm mt-0.5">▸</span>
                      <span className="text-slate-200 font-medium text-sm leading-relaxed">{imp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="section-card group">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-container bg-purple-500/20"><span className="text-purple-300 text-lg">🗒</span></div>
                <h4 className="text-xl font-bold text-white">Executive Summary</h4>
              </div>
              <div className="summary-box">
                <p className="text-slate-200 text-sm sm:text-base leading-relaxed">{analysis.summary}</p>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="section-card group">
              <div className="flex items-center gap-3 mb-6">
                <div className="icon-container bg-cyan-500/20"><span className="text-cyan-300 text-lg">📊</span></div>
                <h4 className="text-xl font-bold text-white">Performance Metrics</h4>
              </div>
              <div className="space-y-4">
                {METRIC_CONFIG.map((cfg, i) => {
                  const value = analysis.performanceMetrics?.[cfg.key] ?? cfg.defaultValue;
                  return (
                    <div key={i} className="group/item">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cfg.icon}</span>
                          <p className="text-slate-200 font-medium">{cfg.label}</p>
                        </div>
                        <span className="text-slate-300 font-bold">{value}/10</span>
                      </div>
                      <div className="progress-bar-small">
                        <div className={`h-full bg-gradient-to-r ${cfg.colorClass} rounded-full transition-all duration-1000 ease-out group-hover/item:shadow-lg ${cfg.shadowClass}`} style={{ width: `${(value / 10) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

             {/* ATS Match Score */}
            {analysis.atsScore !== undefined && (
              <div className="score-card mt-6">
                <div className="text-center mb-4">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">ATS Match Score</h2>
                  <p className="text-4xl font-extrabold text-blue-300 mt-2">{analysis.atsScore}/100</p>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-bold text-blue-300">✅ Matched Keywords</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(analysis.matchedKeywords || []).map((k, i) => (
                      <span key={i} className="keyword-tag bg-blue-600/20 border border-blue-500">{k}</span>
                    ))}
                  </div>
                  <h3 className="text-lg font-bold text-red-300 mt-4">⚠ Missing Keywords</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(analysis.missingKeywords || []).length > 0
                      ? analysis.missingKeywords.map((k, i) => (
                          <span key={i} className="keyword-tag bg-red-600/20 border border-red-500">{k}</span>
                        ))
                      : <p className="text-slate-300 text-sm mt-2">No missing keywords detected for the provided JD.</p>}
                  </div>
                </div>
              </div>
            )}

             {/* ATS Checklist */}
            <div className="section-card group">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-violet-300 text-lg">🧑‍💻</span>
                <h3 className="text-lg font-semi-bold text-violet-300">ATS Compatibility Checklist</h3>
              </div>
              <div className="space-y-2">
                {(presenceChecklist || []).map((item, index) => (
                  <div key={index} className="flex items-start gap-2 text-slate-200">
                    <span className={`${item.present ? "text-emerald-400" : "text-red-400"}`}>
                      {item.present ? "✅" : "❌"}
                    </span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights & Recommended Keywords */}
            <div className="section-card group">
              <div className="flex items-center gap-3 mb-6">
                <div className="icon-container bg-purple-500/20"><span className="text-purple-300 text-lg">⌕</span></div>
                <h4 className="text-xl font-bold text-white">Insights</h4>
              </div>
              <div className="grid gap-4">
                <div className="info-box-violet group/item">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-violet-300 text-lg">🎯</span>
                    <h3 className="text-violet-300 font-semibold">Action Items</h3>
                  </div>
                  <div className="space-y-2">
                    {(analysis.actionItems || [
                      "Optimize keyword placement for better ATS scoring",
                      "Enhance content with quantifiable achievements",
                    ]).map((item, index) => (
                      <div key={index} className="list-item-violet">
                        <span className="text-violet-400 text-sm mt-0.5">▸</span>
                        <span className="text-violet-200 font-medium text-sm leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="info-box-blue group/item">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-blue-300 text-lg">📌</span>
                    <h3 className="text-blue-300 font-semibold">Tips</h3>
                  </div>
                  <div className="space-y-2">
                    {(analysis.proTips || [
                      "Use action verbs to start bullet points",
                      "Tailor keywords to specific job description",
                    ]).map((tip, index) => (
                      <div key={index} className="list-item-blue">
                        <span className="text-blue-400 text-sm mt-0.5">▸</span>
                        <span className="text-slate-200 font-medium text-sm leading-relaxed">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended Keywords */}
                <div className="section-card group">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="icon-container bg-blue-500/20">
                      <span className="text-blue-300 text-lg">🧑‍💻</span>
                    </div>
                    <h2 className="text-xl font-bold text-blue-400">Recommended Keywords</h2>
                  </div>
                  <div className="flex flex-wrap gap-3 mb-4">
                  {(analysis.keywords || []).map((k, i) => (
                 <span key={i} className="keyword-tag group/item">
                   {k}
                 </span>
                 ))}
               </div>
                  <div className="info-box-blue">
                   <p className="text-slate-300 text-sm leading-relaxed flex items-start gap-2 ">
                     <span className="text-lg mt-0.5">
                        💡 Consider incorporating these keywords naturally into your
                         resume to improve ATS compatibility.
                     </span>
                   </p>
                 </div>
               </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default App;
