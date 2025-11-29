import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "../styles/LoginPage.css";

export default function LoginPage() {
  const { setUser } = useContext(AuthContext || { setUser: () => {} });
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  function readUsers() {
    try {
      return JSON.parse(localStorage.getItem("quiz_users") || "[]");
    } catch {
      return [];
    }
  }

  function writeUsers(list) {
    localStorage.setItem("quiz_users", JSON.stringify(list));
  }

  function persistCurrentUser(u) {
    try {
      localStorage.setItem("quiz_current_user", JSON.stringify(u));
    } catch (e) {
      // ignore
    }
  }

  function submit(e) {
    e.preventDefault();
    setErr("");
    if (!name || !email) {
      setErr("Name & email required");
      return;
    }
    const users = readUsers();
    if (isRegister) {
      if (users.find(u => u.email === email)) {
        setErr("Email already registered (in this browser).");
        return;
      }
      const newUser = { name, email, isAdmin: name.trim().toLowerCase() === "manav" };
      users.push(newUser);
      writeUsers(users);
      setUser && setUser(newUser);
      persistCurrentUser(newUser);
      navigate("/");
    } else {
      const found = users.find(u => u.email === email);
      if (!found) {
        setErr("No such user found. Toggle Register to create one.");
        return;
      }
      setUser && setUser(found);
      persistCurrentUser(found);
      navigate("/");
    }
  }

  return (
    <div className="login-page">
      <div className="login-content" role="main" aria-labelledby="login-title">
        <h2 id="login-title" className="login-title">{isRegister ? "Register" : "Login"}</h2>

        <form onSubmit={submit} className="login-form" noValidate>
          <label>
            Name
            <input
              className="login-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              aria-label="Name"
            />
          </label>

          <label>
            Email
            <input
              className="login-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              required
              aria-label="Email"
            />
          </label>

          {err && <div className="error-message" role="alert">{err}</div>}

          <div className="form-actions" style={{ marginTop: 6 }}>
            <button type="submit" className="btn-primary" aria-pressed="false">
              {isRegister ? "Register" : "Login"}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setIsRegister(s => !s); setErr(""); }}
              aria-pressed={isRegister}
            >
              {isRegister ? "Have an account? Login" : "New user? Register"}
            </button>
          </div>
        </form>

        <p className="login-tip">
          Tip: create a user named <strong>manav</strong> to become the admin (as you requested).
        </p>
      </div>
    </div>
  );
}