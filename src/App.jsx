import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import { auth, googleProvider, isAllowed } from "./firebase";

const TOPICS = [
  { id: "planets", label: "Planeten", icon: "🪐", description: "Unser Sonnensystem & seine Körper" },
  { id: "stars", label: "Sterne", icon: "⭐", description: "Sternentwicklung, Typen & Endstadien" },
  { id: "galaxies", label: "Galaxien", icon: "🌌", description: "Struktur, Typen & Kollisionen" },
  { id: "cosmology", label: "Kosmologie", icon: "🔭", description: "Urknall, Expansion & Dunkle Energie" },
  { id: "blackholes", label: "Schwarze Löcher", icon: "⚫", description: "Singularitäten, Hawking-Strahlung & mehr" },
  { id: "exoplanets", label: "Exoplaneten", icon: "🌍", description: "Außerirdische Welten & Lebenssuche" },
];

const SYSTEM_ASTRONOMER = `Du bist ein erfahrener Astrophysiker mit Expertise in allen Bereichen der Astronomie.
Du antwortest präzise, technisch fundiert und auf Deutsch.
Du verwendest korrekte Fachbegriffe und scheust dich nicht vor Zahlen, Formeln und physikalischen Zusammenhängen.
Halte Antworten fokussiert: ausführlich genug für Tiefe, aber nicht unnötig weitschweifig.`;

const SYSTEM_QUIZ_MC = `Du bist ein Astronomie-Quiz-Generator. Erstelle eine Multiple-Choice-Frage auf fortgeschrittenem Niveau auf Deutsch.
Antworte NUR als JSON in diesem Format (kein Markdown, keine Backticks):
{"question":"...", "options":["A) ...","B) ...","C) ...","D) ..."], "correct":0, "explanation":"..."}
correct ist der Index (0-3) der richtigen Antwort. Die Erklärung ist technisch präzise, 2-3 Sätze.`;

const SYSTEM_QUIZ_FREE = `Du bist ein Astronomie-Quiz-Generator. Erstelle eine Freitext-Frage auf fortgeschrittenem Niveau auf Deutsch.
Antworte NUR als JSON in diesem Format (kein Markdown, keine Backticks):
{"question":"...", "keywords":["keyword1","keyword2","keyword3"], "model_answer":"..."}
keywords sind 3-5 Schlüsselbegriffe, die in einer guten Antwort vorkommen sollten. model_answer ist eine Musterantwort.`;

const SYSTEM_QUIZ_EVAL = `Du bewertest eine Antwort auf eine Astronomie-Frage. Sei fair aber anspruchsvoll.
Antworte NUR als JSON (kein Markdown):
{"score": 0-100, "feedback": "...", "correct": true/false}
correct ist true wenn score >= 60.`;

// Changelog – auch im ⓘ-Menü sichtbar. Neueste Version oben.
const CHANGELOG = [
  {
    version: "2.0.0", date: "2026-06-02",
    changes: [
      "Google-Login via Firebase Auth – COSMOS ist jetzt privat für Team Melli & Marc",
      "Nicht freigeschaltete Accounts werden mit freundlichem Hinweis abgemeldet",
      "Logout-Button im ⓘ-Panel",
      "Echter Service Worker mit automatischem Update (kein Neu-Installieren nötig)",
      "Optimiert für iPhone & Samsung (Safe-Area-Ränder)",
    ],
  },
  {
    version: "1.5.0", date: "2026-05-31",
    changes: [
      "Formeln werden als LaTeX/KaTeX schön gesetzt (z. B. Exponenten)",
      "Token-Limit auf 8192 erhöht – keine abgeschnittenen langen Antworten mehr",
    ],
  },
  {
    version: "1.4.0", date: "2026-05-31",
    changes: [
      "KI-Antworten werden als formatiertes Markdown dargestellt (Überschriften, Listen, Hervorhebungen)",
      "Vollständigere Antworten: Token-Limit erhöht, „Thinking“ deaktiviert",
    ],
  },
  {
    version: "1.3.0", date: "2026-05-31",
    changes: [
      "Automatische Update-Erkennung: App lädt neue Versionen selbsttätig nach",
      "Hinweis-Banner „Neue Version verfügbar“ bei Rückkehr zur App",
    ],
  },
  {
    version: "1.2.1", date: "2026-05-31",
    changes: [
      "Modell auf gemini-2.5-flash aktualisiert (2.0-flash war nicht mehr verfügbar)",
    ],
  },
  {
    version: "1.2.0", date: "2026-05-31",
    changes: [
      "KI auf Google Gemini umgestellt (gemini-2.0-flash), direkt im Browser",
      "API-Schlüssel-Eingabe im ⓘ-Menü, nur lokal im Browser gespeichert",
      "Cloudflare-Worker-Proxy entfernt (nicht mehr nötig)",
    ],
  },
  {
    version: "1.1.0", date: "2026-05-31",
    changes: [
      "Serverseitiger KI-Proxy (in v1.2 durch Gemini-Lösung ersetzt)",
      "Verständliche Fehlermeldungen statt stiller Abbrüche",
    ],
  },
  {
    version: "1.0.0", date: "2026-05-31",
    changes: [
      "Erste Version: Infos, Quiz & Chat",
      "Animierter Sternenhimmel & PWA-Manifest",
      "Eigenes App-Icon + iOS-Home-Screen-Support",
      "iOS-Overscroll/Rubber-Band behoben",
    ],
  },
];

// ── Gemini (Google AI Studio) ───────────────────────────────────────────────
// Der API-Key wird NICHT im Code abgelegt, sondern zur Laufzeit eingegeben und
// nur lokal im Browser gespeichert (localStorage). Siehe ⓘ-Menü in der App.
const GEMINI_MODEL = "gemini-2.5-flash";
const KEY_STORAGE = "cosmos_gemini_key";

function getApiKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ""; } catch { return ""; }
}
function setApiKey(value) {
  try {
    if (value) localStorage.setItem(KEY_STORAGE, value);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* localStorage nicht verfügbar */ }
}

async function callAI(messages, system, json = false) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return json ? null : "⚠️ Kein API-Schlüssel hinterlegt. Bitte oben rechts über ⓘ deinen Gemini-Key eintragen.";
  }
  try {
    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: 8192,
        // Thinking abschalten: spart Budget/Zeit und liefert vollständige Antworten.
        thinkingConfig: { thinkingBudget: 0 },
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `Fehler ${res.status}`;
      return json ? null : `⚠️ ${msg}`;
    }
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
    if (json) {
      try {
        return JSON.parse(text.replace(/```json|```/g, "").trim());
      } catch { return null; }
    }
    return text || "⚠️ Leere Antwort erhalten.";
  } catch {
    return json ? null : "⚠️ Verbindung zur Gemini-API fehlgeschlagen.";
  }
}

// ── Markdown-Rendering ───────────────────────────────────────────────────────
const mdComponents = {
  h1: ({ node, ...p }) => <h2 style={{ fontSize: 22, fontWeight: 700, color: "#e9d5ff", margin: "20px 0 10px", fontFamily: "'DM Sans', sans-serif" }} {...p} />,
  h2: ({ node, ...p }) => <h3 style={{ fontSize: 19, fontWeight: 700, color: "#c4b5fd", margin: "18px 0 8px", fontFamily: "'DM Sans', sans-serif" }} {...p} />,
  h3: ({ node, ...p }) => <h4 style={{ fontSize: 16, fontWeight: 600, color: "#a5b4fc", margin: "16px 0 6px", fontFamily: "'DM Sans', sans-serif" }} {...p} />,
  p: ({ node, ...p }) => <p style={{ margin: "0 0 12px" }} {...p} />,
  ul: ({ node, ...p }) => <ul style={{ margin: "0 0 12px", paddingLeft: 22 }} {...p} />,
  ol: ({ node, ...p }) => <ol style={{ margin: "0 0 12px", paddingLeft: 22 }} {...p} />,
  li: ({ node, ...p }) => <li style={{ marginBottom: 4 }} {...p} />,
  strong: ({ node, ...p }) => <strong style={{ color: "#f1f5f9", fontWeight: 700 }} {...p} />,
  em: ({ node, ...p }) => <em style={{ color: "#cbd5e1" }} {...p} />,
  a: ({ node, ...p }) => <a style={{ color: "#818cf8" }} target="_blank" rel="noreferrer" {...p} />,
  hr: () => <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.12)", margin: "16px 0" }} />,
  blockquote: ({ node, ...p }) => <blockquote style={{ borderLeft: "3px solid rgba(139,92,246,0.6)", margin: "0 0 12px", padding: "2px 0 2px 14px", color: "#94a3b8" }} {...p} />,
  code: ({ node, inline, ...p }) => inline
    ? <code style={{ background: "rgba(255,255,255,0.08)", borderRadius: 5, padding: "1px 6px", fontSize: "0.9em", fontFamily: "monospace" }} {...p} />
    : <code style={{ display: "block", background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: 12, overflowX: "auto", fontSize: "0.88em", fontFamily: "monospace", marginBottom: 12 }} {...p} />,
};

function MD({ children }) {
  return (
    <ReactMarkdown
      components={mdComponents}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {children || ""}
    </ReactMarkdown>
  );
}

// ── Stars background ──────────────────────────────────────────────────────────
function StarField() {
  const stars = Array.from({ length: 120 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 5,
    duration: Math.random() * 3 + 2,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {stars.map(s => (
        <div key={s.id} style={{
          position: "absolute",
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: "white",
          opacity: 0,
          animation: `twinkle ${s.duration}s ${s.delay}s infinite ease-in-out`,
        }} />
      ))}
      <style>{`
        @keyframes twinkle { 0%,100%{opacity:0.1} 50%{opacity:0.9} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,0.4)} 50%{box-shadow:0 0 0 8px rgba(139,92,246,0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes gradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      `}</style>
    </div>
  );
}

// ── Info Tab ───────────────────────────────────────────────────────────────────
function InfoTab() {
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(topic) {
    setSelected(topic.id);
    setContent("");
    setLoading(true);
    const text = await callAI(
      [{ role: "user", content: `Gib mir einen technisch fundierten Überblick über: ${topic.label} – ${topic.description}. Strukturiere mit kurzen Abschnitten. Verwende Fakten, Zahlen und Fachbegriffe.` }],
      SYSTEM_ASTRONOMER
    );
    setContent(text);
    setLoading(false);
  }

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <p style={{ color: "#94a3b8", marginBottom: 24, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Thema wählen
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 32 }}>
        {TOPICS.map(t => (
          <button key={t.id} onClick={() => load(t)} style={{
            background: selected === t.id ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
            border: selected === t.id ? "1px solid rgba(139,92,246,0.7)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "16px", cursor: "pointer", textAlign: "left",
            transition: "all 0.2s", color: "white",
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15 }}>{t.label}</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{t.description}</div>
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#94a3b8" }}>
          <div style={{ width: 20, height: 20, border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Lade Informationen…
        </div>
      )}

      {content && (
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: 28, animation: "fadeIn 0.4s ease",
          lineHeight: 1.8, color: "#e2e8f0", fontSize: 15,
          fontFamily: "'Crimson Pro', Georgia, serif",
        }}>
          <MD>{content}</MD>
        </div>
      )}
    </div>
  );
}

// ── Quiz Tab ───────────────────────────────────────────────────────────────────
function QuizTab() {
  const [mode, setMode] = useState(null); // 'mc' | 'free'
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [evalResult, setEvalResult] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [topic, setTopic] = useState("random");

  async function loadQuestion(m) {
    setMode(m);
    setQuestion(null);
    setSelected(null);
    setSubmitted(false);
    setFreeText("");
    setEvalResult(null);
    setLoading(true);
    const topicHint = topic === "random" ? "einem zufälligen Astronomie-Thema" : TOPICS.find(t => t.id === topic)?.label;
    const sys = m === "mc" ? SYSTEM_QUIZ_MC : SYSTEM_QUIZ_FREE;
    const q = await callAI(
      [{ role: "user", content: `Erstelle eine Frage zu: ${topicHint}` }],
      sys, true
    );
    setQuestion(q);
    setLoading(false);
  }

  function submitMC(idx) {
    if (submitted) return;
    setSelected(idx);
    setSubmitted(true);
    const correct = idx === question.correct;
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
  }

  async function submitFree() {
    if (!freeText.trim() || evalLoading) return;
    setEvalLoading(true);
    const result = await callAI(
      [{ role: "user", content: `Frage: ${question.question}\nSchlüsselbegriffe: ${question.keywords.join(", ")}\nMusterantwort: ${question.model_answer}\nGegebene Antwort: ${freeText}` }],
      SYSTEM_QUIZ_EVAL, true
    );
    setEvalResult(result);
    setEvalLoading(false);
    if (result) {
      setScore(s => ({ correct: s.correct + (result.correct ? 1 : 0), total: s.total + 1 }));
    }
  }

  const scoreColor = score.total === 0 ? "#64748b" : score.correct / score.total >= 0.7 ? "#4ade80" : "#f87171";

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
        <select value={topic} onChange={e => setTopic(e.target.value)} style={{
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8, padding: "8px 14px", color: "white", fontSize: 14, cursor: "pointer",
        }}>
          <option value="random">🎲 Zufälliges Thema</option>
          {TOPICS.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>
        <button onClick={() => loadQuestion("mc")} style={btnStyle("#3b82f6")}>
          Multiple Choice
        </button>
        <button onClick={() => loadQuestion("free")} style={btnStyle("#8b5cf6")}>
          Freitext
        </button>
        <div style={{ marginLeft: "auto", color: scoreColor, fontFamily: "monospace", fontSize: 15 }}>
          {score.total > 0 && `${score.correct} / ${score.total} korrekt`}
        </div>
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#94a3b8" }}>
          <div style={{ width: 20, height: 20, border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Generiere Frage…
        </div>
      )}

      {question && mode === "mc" && (
        <div style={{ animation: "fadeIn 0.4s ease" }}>
          <div style={cardStyle}>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#e2e8f0", marginBottom: 24, fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 18 }}>
              {question.question}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {question.options?.map((opt, i) => {
                let bg = "rgba(255,255,255,0.04)";
                let border = "1px solid rgba(255,255,255,0.08)";
                if (submitted) {
                  if (i === question.correct) { bg = "rgba(74,222,128,0.15)"; border = "1px solid rgba(74,222,128,0.5)"; }
                  else if (i === selected && i !== question.correct) { bg = "rgba(248,113,113,0.15)"; border = "1px solid rgba(248,113,113,0.5)"; }
                }
                return (
                  <button key={i} onClick={() => submitMC(i)} style={{
                    background: bg, border, borderRadius: 10, padding: "12px 16px",
                    color: "#e2e8f0", textAlign: "left", cursor: submitted ? "default" : "pointer",
                    fontSize: 14, transition: "all 0.2s",
                  }}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <div style={{ marginTop: 20, padding: "16px", background: "rgba(255,255,255,0.04)", borderRadius: 10, color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>
                <strong style={{ color: "#e2e8f0" }}>Erklärung: </strong>{question.explanation}
              </div>
            )}
          </div>
          {submitted && (
            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button onClick={() => loadQuestion("mc")} style={btnStyle("#8b5cf6")}>Nächste MC-Frage</button>
              <button onClick={() => loadQuestion("free")} style={btnStyle("#3b82f6")}>Freitext-Frage</button>
            </div>
          )}
        </div>
      )}

      {question && mode === "free" && (
        <div style={{ animation: "fadeIn 0.4s ease" }}>
          <div style={cardStyle}>
            <p style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 18, lineHeight: 1.7, color: "#e2e8f0", marginBottom: 20 }}>
              {question.question}
            </p>
            <textarea
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="Deine Antwort…"
              rows={5}
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                padding: 14, color: "#e2e8f0", fontSize: 14, resize: "vertical",
                fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, boxSizing: "border-box",
              }}
            />
            {!evalResult && (
              <button onClick={submitFree} disabled={evalLoading || !freeText.trim()} style={{ ...btnStyle("#8b5cf6"), marginTop: 12, opacity: (!freeText.trim() || evalLoading) ? 0.5 : 1 }}>
                {evalLoading ? "Wird bewertet…" : "Antwort einreichen"}
              </button>
            )}
            {evalResult && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                  <div style={{
                    fontSize: 36, fontWeight: 700, fontFamily: "monospace",
                    color: evalResult.correct ? "#4ade80" : "#f87171",
                  }}>{evalResult.score}%</div>
                  <div style={{ color: evalResult.correct ? "#4ade80" : "#f87171", fontSize: 15 }}>
                    {evalResult.correct ? "✓ Korrekt" : "✗ Nicht ausreichend"}
                  </div>
                </div>
                <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
                  <strong style={{ color: "#e2e8f0" }}>Feedback: </strong>{evalResult.feedback}
                </div>
                <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, color: "#64748b", fontSize: 13, lineHeight: 1.7 }}>
                  <strong style={{ color: "#94a3b8" }}>Musterantwort: </strong>{question.model_answer}
                </div>
              </div>
            )}
          </div>
          {evalResult && (
            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button onClick={() => loadQuestion("free")} style={btnStyle("#8b5cf6")}>Nächste Freitext-Frage</button>
              <button onClick={() => loadQuestion("mc")} style={btnStyle("#3b82f6")}>Multiple Choice</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chat Tab ───────────────────────────────────────────────────────────────────
function ChatTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    const reply = await callAI(newMsgs, SYSTEM_ASTRONOMER);
    setMessages([...newMsgs, { role: "assistant", content: reply }]);
    setLoading(false);
  }

  const suggestions = [
    "Was ist der Unterschied zwischen einem Neutronenstern und einem Schwarzen Loch?",
    "Erkläre Hawking-Strahlung",
    "Wie entstand das Sonnensystem?",
    "Was ist Dunkle Materie?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 280px)", minHeight: 400, animation: "fadeIn 0.4s ease" }}>
      {messages.length === 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Vorschläge</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => setInput(s)} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20, padding: "7px 14px", color: "#94a3b8", fontSize: 13, cursor: "pointer",
                transition: "all 0.2s",
              }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingRight: 4 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            animation: "fadeIn 0.3s ease",
          }}>
            <div style={{
              maxWidth: "80%",
              background: m.role === "user"
                ? "linear-gradient(135deg, #6d28d9, #4f46e5)"
                : "rgba(255,255,255,0.05)",
              border: m.role === "assistant" ? "1px solid rgba(255,255,255,0.08)" : "none",
              borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "14px 18px",
              color: "#e2e8f0",
              fontSize: 14,
              lineHeight: 1.75,
              fontFamily: m.role === "assistant" ? "'Crimson Pro', Georgia, serif" : "'DM Sans', sans-serif",
              fontSize: m.role === "assistant" ? 16 : 14,
              whiteSpace: m.role === "assistant" ? "normal" : "pre-wrap",
            }}>
              {m.role === "assistant" ? <MD>{m.content}</MD> : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 6, padding: "14px 18px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 7, height: 7, borderRadius: "50%", background: "#8b5cf6",
                animation: `twinkle 1.2s ${i * 0.2}s infinite ease-in-out`,
              }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Frage zur Astronomie…"
          style={{
            flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12, padding: "12px 16px", color: "white", fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
        <button onClick={send} disabled={!input.trim() || loading} style={{
          ...btnStyle("#8b5cf6"), padding: "12px 20px",
          opacity: (!input.trim() || loading) ? 0.5 : 1,
        }}>
          ↑
        </button>
      </div>
    </div>
  );
}

// ── Info Modal ──────────────────────────────────────────────────────────────────
function InfoModal({ onClose, user, onLogout }) {
  const [keyInput, setKeyInput] = useState(getApiKey());
  const [saved, setSaved] = useState(false);
  const hasKey = getApiKey().length > 0;

  function save() {
    setApiKey(keyInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  function clear() {
    setApiKey("");
    setKeyInput("");
    setSaved(false);
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20, padding: 32, maxWidth: 480, width: "100%",
        maxHeight: "85vh", overflowY: "auto",
        animation: "fadeIn 0.3s ease",
      }}>
        <h2 style={{ color: "white", marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>🔭 COSMOS – Info</h2>

        {/* Konto */}
        <div style={{ ...cardStyle, padding: 18, marginBottom: 22 }}>
          <strong style={{ color: "#e2e8f0", fontSize: 15 }}>Angemeldet</strong>
          <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: "6px 0 12px", wordBreak: "break-all" }}>
            {user?.displayName ? `${user.displayName} · ` : ""}{user?.email || "—"}
          </p>
          <button onClick={onLogout} style={btnStyle("#f87171")}>Abmelden</button>
        </div>

        {/* API-Key */}
        <div style={{ ...cardStyle, padding: 18, marginBottom: 22 }}>
          <strong style={{ color: "#e2e8f0", fontSize: 15 }}>Gemini API-Schlüssel</strong>
          <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6, margin: "6px 0 12px" }}>
            Nötig für Infos, Quiz & Chat. Wird nur lokal in deinem Browser
            gespeichert – nie hochgeladen.{" "}
            <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" style={{ color: "#818cf8" }}>
              Schlüssel holen ↗
            </a>
          </p>
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="AIza…"
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10, padding: "11px 14px", color: "white", fontSize: 14,
              fontFamily: "monospace",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={save} disabled={!keyInput.trim()} style={{ ...btnStyle("#8b5cf6"), opacity: keyInput.trim() ? 1 : 0.5 }}>
              Speichern
            </button>
            {hasKey && (
              <button onClick={clear} style={btnStyle("#f87171")}>Entfernen</button>
            )}
            <span style={{ fontSize: 13, color: saved ? "#4ade80" : hasKey ? "#94a3b8" : "#64748b" }}>
              {saved ? "✓ Gespeichert" : hasKey ? "● Schlüssel hinterlegt" : "Kein Schlüssel"}
            </span>
          </div>
        </div>

        <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.8 }}>
          <strong style={{ color: "#e2e8f0" }}>Features</strong>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>KI-generierte Infotexte zu 6 Astronomie-Themen</li>
            <li>Quiz: Multiple Choice & Freitext mit KI-Bewertung</li>
            <li>Freier Chat mit einem Astrophysik-Experten</li>
          </ul>

          <strong style={{ color: "#e2e8f0", display: "block", marginTop: 16 }}>Changelog</strong>
          <div style={{ marginTop: 8 }}>
            {CHANGELOG.map(rel => (
              <div key={rel.version} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd" }}>
                  v{rel.version}
                  <span style={{ color: "#64748b", fontWeight: 400, marginLeft: 6 }}>· {rel.date}</span>
                </div>
                <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                  {rel.changes.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            ))}
          </div>

          <strong style={{ color: "#e2e8f0", display: "block", marginTop: 16 }}>Tech-Stack</strong>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>React (PWA, Service Worker mit Auto-Update)</li>
            <li>Firebase Auth – Google-Login (nur Login, keine Datenhaltung)</li>
            <li>Google Gemini API – {GEMINI_MODEL}</li>
            <li>Daten & Key bleiben lokal im Browser (localStorage)</li>
          </ul>
          <strong style={{ color: "#e2e8f0", display: "block", marginTop: 16 }}>Version</strong>
          <p style={{ marginTop: 4 }}>v{CHANGELOG[0].version} – Team Melli &amp; Marc ✦</p>
        </div>
        <button onClick={onClose} style={{ ...btnStyle("#8b5cf6"), marginTop: 24, width: "100%" }}>
          Schließen
        </button>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function btnStyle(color) {
  return {
    background: `${color}22`,
    border: `1px solid ${color}66`,
    borderRadius: 10, padding: "10px 20px",
    color: "white", cursor: "pointer", fontSize: 14,
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
    transition: "all 0.2s", whiteSpace: "nowrap",
  };
}

const cardStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16, padding: 28,
};

// ── Cosmic Shell (gemeinsamer Hintergrund) ──────────────────────────────────────
function Shell({ children }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 10%, #1e1040 0%, #080c1a 40%, #000510 100%)",
      backgroundSize: "200% 200%",
      animation: "gradShift 20s ease infinite",
      color: "white",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />
      <StarField />
      {children}
    </div>
  );
}

const safeAreaPadding = "calc(env(safe-area-inset-top) + 8px) calc(env(safe-area-inset-right) + 20px) calc(env(safe-area-inset-bottom) + 60px) calc(env(safe-area-inset-left) + 20px)";

// ── Splash (während Auth-Status geladen wird) ───────────────────────────────────
function SplashScreen() {
  return (
    <Shell>
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div style={{ fontSize: 30, fontWeight: 700, background: "linear-gradient(135deg, #c4b5fd, #818cf8, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✦ COSMOS</div>
        <div style={{ width: 26, height: 26, border: "3px solid rgba(139,92,246,0.3)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    </Shell>
  );
}

// ── Login-Screen ────────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.5-.2-2.6-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 15.5 2 8.1 6.8 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 46c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6c-2 1.5-4.7 2.4-7.7 2.4-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C8 41.1 15.4 46 24 46z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.6 5.6C42.5 36 46 30.6 46 24c0-1.5-.2-2.6-.4-3.5z"/>
    </svg>
  );
}

function LoginScreen({ onLogin, busy, error }) {
  return (
    <Shell>
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: safeAreaPadding, boxSizing: "border-box" }}>
        <div style={{
          ...cardStyle, padding: 32, maxWidth: 380, width: "100%", textAlign: "center",
          animation: "fadeIn 0.4s ease",
        }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #c4b5fd, #818cf8, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ✦ COSMOS
          </div>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: "10px 0 4px" }}>
            Astronomie – Wissen &amp; Quiz
          </p>
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 28px" }}>
            Privat für <strong style={{ color: "#c4b5fd" }}>Team Melli &amp; Marc</strong> ✦
          </p>

          <button onClick={onLogin} disabled={busy} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            width: "100%", boxSizing: "border-box",
            background: "white", color: "#1f2937", border: "none",
            borderRadius: 12, padding: "13px 18px", cursor: busy ? "default" : "pointer",
            fontSize: 15, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
            opacity: busy ? 0.6 : 1, transition: "all 0.2s",
          }}>
            {busy
              ? <span style={{ width: 18, height: 18, border: "2px solid rgba(31,41,55,0.3)", borderTopColor: "#1f2937", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              : <GoogleIcon />}
            {busy ? "Anmeldung…" : "Mit Google anmelden"}
          </button>

          {error && (
            <div style={{
              marginTop: 18, padding: 14, borderRadius: 12,
              background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)",
              color: "#fca5a5", fontSize: 13, lineHeight: 1.6, animation: "fadeIn 0.3s ease",
            }}>
              {error}
            </div>
          )}

          <p style={{ color: "#475569", fontSize: 11, lineHeight: 1.6, marginTop: 24 }}>
            Nur freigeschaltete Google-Konten haben Zugriff. Es werden nur Login-Daten
            (Name, E-Mail) verwendet – keine Inhalte gespeichert.
          </p>
        </div>
      </div>
    </Shell>
  );
}

// ── Angemeldete App ─────────────────────────────────────────────────────────────
function CosmosApp({ user, onLogout }) {
  const [tab, setTab] = useState("info");
  const [showInfo, setShowInfo] = useState(false);

  const tabs = [
    { id: "info", label: "Infos", icon: "📚" },
    { id: "quiz", label: "Quiz", icon: "🧠" },
    { id: "chat", label: "Chat", icon: "💬" },
  ];

  return (
    <Shell>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", padding: safeAreaPadding }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0 40px" }}>
          <div>
            <h1 style={{
              fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em",
              background: "linear-gradient(135deg, #c4b5fd, #818cf8, #38bdf8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              margin: 0,
            }}>
              ✦ COSMOS
            </h1>
            <p style={{ color: "#475569", fontSize: 13, marginTop: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Astronomie · Team Melli &amp; Marc
            </p>
          </div>
          <button onClick={() => setShowInfo(true)} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
            color: "#94a3b8", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}>ⓘ</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 32, background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, border: "none",
              background: tab === t.id ? "rgba(139,92,246,0.3)" : "transparent",
              color: tab === t.id ? "white" : "#64748b",
              cursor: "pointer", fontSize: 14, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.2s",
              boxShadow: tab === t.id ? "0 0 0 1px rgba(139,92,246,0.4)" : "none",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "info" && <InfoTab />}
        {tab === "quiz" && <QuizTab />}
        {tab === "chat" && <ChatTab />}
      </div>

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} user={user} onLogout={onLogout} />}
    </Shell>
  );
}

// ── Auth-Gate ────────────────────────────────────────────────────────────────────
export default function App() {
  const [status, setStatus] = useState("loading"); // loading | out | in
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Ergebnis eines evtl. Redirect-Logins abholen (Fallback-Flow).
    getRedirectResult(auth).catch(() => {});
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setUser(null); setStatus("out"); return; }
      if (!isAllowed(u.email)) {
        setAuthError(`Schade – ${u.email} ist für COSMOS nicht freigeschaltet. Diese App ist privat für Team Melli & Marc. 💫`);
        try { await signOut(auth); } catch { /* ignore */ }
        setUser(null);
        setStatus("out");
        return;
      }
      setAuthError("");
      setUser(u);
      setStatus("in");
    });
    return unsub;
  }, []);

  async function login() {
    setAuthError("");
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // vom Nutzer abgebrochen – keine Fehlermeldung nötig
      } else if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (e2) {
          setAuthError("Anmeldung nicht möglich: " + (e2?.message || e2?.code || "Unbekannter Fehler"));
        }
      } else if (code === "auth/unauthorized-domain") {
        setAuthError("Diese Adresse ist in Firebase noch nicht freigegeben (autorisierte Domain fehlt).");
      } else {
        setAuthError("Anmeldung fehlgeschlagen: " + (e?.message || code || "Unbekannter Fehler"));
      }
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    signOut(auth).catch(() => {});
  }

  if (status === "loading") return <SplashScreen />;
  if (status !== "in") return <LoginScreen onLogin={login} busy={busy} error={authError} />;
  return <CosmosApp user={user} onLogout={logout} />;
}
