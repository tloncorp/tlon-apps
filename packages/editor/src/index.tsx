import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './app';
import './index.css';

const contentInjected = () => window.contentInjected;

const interval = setInterval(() => {
  if (!contentInjected()) return;
  // Once content is injected into the webview, we can render the editor
  const container = document.getElementById('root');
  const root = createRoot(container!);
  root.render(<App />);
  clearInterval(interval);
  return;
}, 1);
