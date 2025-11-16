// frontend/src/components/AdminPage.js
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/AdminPage.css";
import infoImage from '../assets/images/infoimage.jpg';

function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const AdminPage = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, title: "" });
  const navigate = useNavigate();
  const API_BASE = "http://localhost:5001/api";

  // fetch quizzes (used for mapping quiz_id -> title)
  const fetchQuizzes = async (qterm = "") => {
    setIsLoading(true);
    setError(null);
    try {
      const url = qterm
        ? `${API_BASE}/quizzes?q=${encodeURIComponent(qterm)}`
        : `${API_BASE}/quizzes`;
      const res = await axios.get(url);
      setQuizzes(res.data.quizzes || []);
    } catch (err) {
      console.error("Failed to load quizzes:", err);
      setError("Failed to load quizzes");
    } finally {
      setIsLoading(false);
    }
  };

  // fetch all results (for admin table)
  const fetchResults = async () => {
    setIsLoadingResults(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/results`);
      setResults(res.data.results || []);
    } catch (err) {
      console.error("Failed to load results:", err);
      setError("Failed to load results");
    } finally {
      setIsLoadingResults(false);
    }
  };

  useEffect(() => {
    fetchQuizzes(debouncedSearch);
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const openQuiz = (quizId) => {
    if (!quizId) return;
    navigate(`/quiz?quiz_id=${quizId}`);
  };

  const onDeleteClick = (id, title) => {
    setConfirmDelete({ open: true, id, title });
  };

  const confirmDeleteNow = async () => {
    const id = confirmDelete.id;
    if (!id) return;
    setIsDeleting(true);
    try {
      await axios.delete(`${API_BASE}/quizzes/${id}`);
      await fetchQuizzes(debouncedSearch);
      await fetchResults();
      setConfirmDelete({ open: false, id: null, title: "" });
    } catch (err) {
      console.error("Delete failed:", err);
      setError("Failed to delete quiz");
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => setConfirmDelete({ open: false, id: null, title: "" });

  const quizzesById = useMemo(() => {
    const map = {};
    (quizzes || []).forEach((q) => {
      if (q && (q.id !== undefined && q.id !== null)) map[q.id] = q;
    });
    return map;
  }, [quizzes]);

  // filter results by search (search matches username, email, quiz title, or ids)
  const filteredResults = useMemo(() => {
    if (!search) return results;
    const s = search.toLowerCase();
    return (results || []).filter((r) => {
      const username = (r.user && (r.user.name || r.user.email)) || "";
      const title = (quizzesById[r.quiz_id] && quizzesById[r.quiz_id].title) || "";
      return String(r.id).toLowerCase().includes(s)
        || String(r.quiz_id || "").toLowerCase().includes(s)
        || username.toLowerCase().includes(s)
        || title.toLowerCase().includes(s)
        || String(r.score || "").toLowerCase().includes(s);
    });
  }, [results, search, quizzesById]);

  return (
    <div className="admin-page-root">
      <div
        className="admin-hero"
        style={{ backgroundImage: `url(${infoImage})` }}
        aria-hidden="true"
      >
        <div className="admin-hero-inner">
          <div>
            <h1 className="admin-title">Admin — Quiz Attempts</h1>
            <p className="admin-sub">View all quiz attempts</p>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <input
            className="admin-search"
            placeholder="Filter by username, quiz title, score or id..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search attempts"
          />
          <div className="toolbar-actions">
            <button
              className="small-btn secondary"
              onClick={() => { fetchQuizzes(debouncedSearch); fetchResults(); }}
              disabled={isLoading || isLoadingResults}
              aria-disabled={isLoading || isLoadingResults}
            >
              Refresh
            </button>
          </div>
        </div>

        {(isLoading || isLoadingResults) && <div className="loading">Loading…</div>}
        {error && <div className="error">{error}</div>}

        {!isLoading && !isLoadingResults && (!filteredResults || filteredResults.length === 0) && (
          <div className="empty-note">No attempts found.</div>
        )}

        {!isLoading && !isLoadingResults && filteredResults && filteredResults.length > 0 && (
          <div className="table-responsive">
            <table className="admin-table" role="grid" aria-label="Quiz attempts">
              <thead>
                <tr>
                  <th>Result ID</th>
                  <th>Username</th>
                  <th>Quiz Title</th>
                  <th>Score</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r) => {
                  const userDisplay = (r.user && (r.user.name || r.user.email)) || "Anonymous";
                  const quiz = quizzesById[r.quiz_id];
                  const title = quiz ? quiz.title : `Quiz #${r.quiz_id || "—"}`;
                  return (
                    <tr key={r.id} className="result-row" role="row" tabIndex={0}>
                      <td data-label="Result ID">{r.id}</td>
                      <td data-label="Username">{userDisplay}</td>
                      <td data-label="Quiz Title">
                        <button
                          className="link-btn"
                          onClick={() => openQuiz(r.quiz_id)}
                          title={`Open quiz ${r.quiz_id}`}
                        >
                          {title}
                        </button>
                      </td>
                      <td data-label="Score">{r.score} / {r.total}</td>
                      <td data-label="Created At">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                      </td>
                      <td data-label="Actions">
                        <div className="action-buttons">
                          <button
                            className="open-btn"
                            onClick={() => openQuiz(r.quiz_id)}
                            aria-label={`Open quiz ${r.quiz_id}`}
                          >
                            Open Quiz
                          </button>

                          {/* keep quiz delete option (deletes the whole quiz) */}
                          <button
                            className="delete-btn"
                            onClick={() => onDeleteClick(r.quiz_id, title)}
                            title="Delete quiz"
                            aria-label={`Delete quiz ${r.quiz_id}`}
                          >
                            &#x1F5D1;
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete.open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card" role="document">
            <h3>Delete quiz?</h3>
            <p>
              Are you sure you want to delete{" "}
              <strong>{confirmDelete.title || `#${confirmDelete.id}`}</strong>? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={cancelDelete} disabled={isDeleting}>Cancel</button>
              <button className="modal-confirm" onClick={confirmDeleteNow} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;