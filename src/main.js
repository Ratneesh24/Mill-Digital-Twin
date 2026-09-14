import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted variable fonts — no CDN, so the twin runs on an isolated plant
// network exactly as it does on the office LAN.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { App } from './app/App';
import './index.css';
const container = document.getElementById('root');
if (!container)
    throw new Error('Root element #root not found');
createRoot(container).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
