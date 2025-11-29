import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import '../styles/ResultPage.css';

export default function ResultPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadFromBackend() {
      try {
        const res = await fetch("import.meta.env.VITE_API_BASE_URL/results/latest");
        if (!res.ok) throw new Error(`no backend result (${res.status})`);
        const data = await res.json();
        if (mounted) { setResult(data); setLoading(false); }
      } catch (err) {
        const raw = localStorage.getItem("lastQuizResult");
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (mounted) {
              const normalized = parsed.detailed ? parsed : (parsed.saved_result ? {
                score: parsed.saved_result.score ?? parsed.score,
                total: parsed.saved_result.total ?? parsed.total,
                detailed: parsed.saved_result.answers ?? parsed.detailed ?? parsed.saved_result.detailed ?? parsed.answers
              } : parsed);
              setResult(normalized);
              setLoading(false);
            }
          } catch (e) {
            if (mounted) { setError("Failed to parse stored result."); setLoading(false); }
          }
        } else {
          if (mounted) { setError("No result found. Make sure you submitted a quiz or your backend exposes GET /api/results/latest"); setLoading(false); }
        }
      }
    }

    loadFromBackend();
    return () => (mounted = false);
  }, []);

  function formatPercent(score, total) {
    if (!total || total === 0) return "0%";
    return `${Math.round((score / total) * 100)}%`;
  }

  function downloadCSV() {
    if (!result) return;
    const rows = [];
    rows.push(["Question", "Selected Answer", "Correct Answer", "Is Correct", "Explanation"].join(","));
    (result.detailed || []).forEach((d) => {
      const q = `"${(d.questionText || d.question || '').replace(/"/g, '""')}"`;
      const sel = `"${(d.selectedText || d.selected || '').replace(/"/g, '""')}"`;
      const corr = `"${(d.correctText || d.correct || '').replace(/"/g, '""')}"`;
      const ok = d.isCorrect ? "TRUE" : "FALSE";
      const ex = `"${(d.explanation || '').replace(/"/g, '""')}"`;
      rows.push([q, sel, corr, ok, ex].join(","));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz-result-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="result-page-root">
        <Navbar />
        <main className="result-main">
          <div className="result-card loading-card">
            Loading result...
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="result-page-root">
        <Navbar />
        <main className="result-main">
          <div className="result-card">
            <h2 className="result-title">No result found</h2>
            <p className="muted">{error}</p>
            <div className="result-actions">
              <button onClick={() => navigate(-1)} className="btn btn-primary">Go back</button>
              <button onClick={() => { localStorage.removeItem("lastQuizResult"); window.location.reload(); }} className="btn btn-muted">Clear stored result</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const summaryScore = result.score ?? result.totalCorrect ?? 0;
  const summaryTotal = result.total ?? result.totalQuestions ?? (result.detailed ? result.detailed.length : 0);

  return (
    <div className="result-page-root">
      <main className="result-main">
        <section className="result-card">
          <header className="result-header">
            <div>
              <h1 className="result-title">Quiz Result</h1>
              <p className="muted">Review your last quiz attempt below.</p>
            </div>

            <div className="result-score">
              <div className="score">{summaryScore} / {summaryTotal}</div>
              <div className="percent">{formatPercent(summaryScore, summaryTotal)}</div>
            </div>
          </header>

          <div className="result-actions">
            <button onClick={() => navigate('/')} className="btn btn-primary">Home</button>
            <button onClick={() => navigate(-1)} className="btn btn-primary-outline">Back</button>
            <button onClick={downloadCSV} className="btn btn-accent">Export CSV</button>
            <button onClick={() => { localStorage.removeItem("lastQuizResult"); alert("Cleared stored lastQuizResult from localStorage."); }} className="btn btn-danger">Clear Stored Result</button>
          </div>

          <div className="result-list">
            {(result.detailed || []).map((d, idx) => (
              <article className="result-item" key={idx}>
                <div className="item-top">
                  <div className="q-text">{idx + 1}. {d.questionText || d.question || 'Untitled question'}</div>

                  <div className="status-pill-wrapper">
                    <span className={`status-pill ${d.isCorrect ? 'correct' : 'wrong'}`}>{d.isCorrect ? 'Correct' : 'Wrong'}</span>
                  </div>
                </div>

                <div className="answers">
                  <div className={`answer ${d.isCorrect ? 'correct' : 'wrong'}`}>
                    <div className="label">Your answer</div>
                    <div className="value">{d.selectedText || d.selected || '—'}</div>
                  </div>

                  <div className="answer">
                    <div className="label">Correct answer</div>
                    <div className="value">{d.correctText || d.correct || '—'}</div>
                  </div>
                </div>

                {d.explanation ? <div className="explanation">Explanation: {d.explanation}</div> : null}
              </article>
            ))}

            {(!result.detailed || result.detailed.length === 0) && (
              <div className="result-item">No per-question details available for this result.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
