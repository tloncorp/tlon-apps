import React from 'react';
import { render } from 'react-dom';
import App from './app';
import { IS_MOCK } from './api';

import './assets/Inter-roman.var.woff2';
import './assets/Inter-italic.var.woff2';
import './assets/SourceCodePro-VariableFont_wght-subset.woff2';

import './styles/index.css';

if (IS_MOCK) {
  window.ship = 'finned-palmer';
}
window.our = `~${window.ship}`;

const root = document.getElementById('app') as HTMLElement;
render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  root
);
