import React from 'react';
import { render } from 'react-dom';
import App from './app';
import './styles/index.css';
window.our = `~${window.ship}`;

const root = document.getElementById('app') as HTMLElement;
render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  root
);
