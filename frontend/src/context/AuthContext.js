// src/context/AuthContext.js
import React, { createContext, useEffect, useState } from "react";


export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("quiz_user") || "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem("quiz_user", JSON.stringify(user));
    else localStorage.removeItem("quiz_user");
  }, [user]);

  function logout() {
    setUser(null);
    localStorage.removeItem("quiz_user");
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
