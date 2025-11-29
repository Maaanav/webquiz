// frontend/src/index.js

import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import './index.css'; // Import global styles if any

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter> {/* Single Router wrapping the entire App */}
      <App />
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
);
