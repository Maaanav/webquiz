// frontend/src/App.js

import React from 'react';
import { Routes, Route } from 'react-router-dom'; // No Router here
import HomePage from './components/HomePage';
import QuizPage from './components/QuizPage';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <Routes> {/* Routes are children of the Router in index.js */}
      <Route path="/" element={<HomePage />} />
      <Route 
        path="/quiz" 
        element={
          <ErrorBoundary>
            <QuizPage />
          </ErrorBoundary>
        } 
      />
      {/* Add more routes here if needed */}
    </Routes>
  );
}

export default App;
