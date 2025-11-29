import React, { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Navbar.css";
import { AuthContext } from "../context/AuthContext";


export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext || { user: null, logout: () => {} });

  const links = [
    { label: "Home", action: () => handleNavigate("/") },
    { label: "Quiz", action: () => handleScrollTo("/","file-upload-section") },
    { label: "Info", action: () => handleScrollTo("/","info-section") },
    { label: "Results", action: () => handleNavigate("/results") },
  ];

  function handleNavigate(path) {
    if (location.pathname !== path) navigate(path);
  }

  function handleScrollTo(path, elementId) {
    if (location.pathname === path) {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    navigate(path);
    const maxTries = 12;
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        clearInterval(t);
        return;
      }
      if (tries >= maxTries) clearInterval(t);
    }, 150);
  }

  function onLogout() {
    try { logout && logout(); } catch (e) {}
    navigate("/");
  }

  return (
    <header className="nav-wrap" role="navigation" aria-label="Main nav">
      <nav className="navbar">
        <div className="navbar-inner">
          <div
            className="brand"
            onClick={() => handleNavigate("/")}
            onKeyDown={(e) => (e.key === "Enter" ? handleNavigate("/") : null)}
            role="button"
            tabIndex={0}
            aria-label="Go to home"
          >
            QuizWeb
          </div>

          <div className="nav-links">
            {links.map((ln) => (
              <button
                key={ln.label}
                onClick={ln.action}
                className={`nav-link ${location.pathname === "/" && (ln.label === "Home" || ln.label === "Quiz" || ln.label === "Info") ? "active" : (location.pathname === "/results" && ln.label === "Results" ? "active" : "")}`}
              >
                {ln.label}
              </button>
            ))}
          </div>

          <div className="nav-actions">
            {!user ? (
              <button className="nav-link login-btn" onClick={() => navigate("/login")}>Login / Register</button>
            ) : (
              <div className="user-block" aria-label="User controls">
                <span className="user-name" title={user.email}>{user.name}</span>
                {user.isAdmin && (
                  <button className="nav-link admin-btn" onClick={() => navigate("/admin")}>Admin</button>
                )}
                <button className="nav-link logout-btn" onClick={onLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
