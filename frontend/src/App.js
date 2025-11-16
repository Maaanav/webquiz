// src/App.js (edit)
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import QuizPage from './components/QuizPage';
import AdminPage from './components/AdminPage';
import ResultPage from './components/ResultPage';
import ErrorBoundary from './components/ErrorBoundary';

// add
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./components/LoginPage";
import Navbar from "./components/Navbar";

function App() {
  return (
    <AuthProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/quiz" element={<ErrorBoundary><QuizPage /></ErrorBoundary>} />
        <Route path="/results" element={<ErrorBoundary><ResultPage /></ErrorBoundary>} />
        <Route path="/admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;