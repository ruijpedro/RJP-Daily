import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './style.css';
import {notifyOtaReady} from './services/ota.js';
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

// Confirma o carregamento antes de o mecanismo OTA avaliar eventuais rollbacks.
void notifyOtaReady();
