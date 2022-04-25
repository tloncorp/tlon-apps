import React from 'react';
import { render } from 'react-dom';
import App from './app';
import './index.css';

const root = document.getElementById('app') as HTMLElement;
render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  root
);
