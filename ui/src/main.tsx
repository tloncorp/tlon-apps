/* eslint-disable import/first */
console.log(import.meta.env);
console.log(import.meta.env.VITE_ENABLE_WDYR);
if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_WDYR === 'true') {
  // nothing needs to be done with this variable but one needs to be declared in order to import the module
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const autoImport = import.meta.glob('./wdyr.ts', { eager: true });
}

/* eslint-disable */
import { EditorView } from 'prosemirror-view';

const oldUpdateState = EditorView.prototype.updateState;

EditorView.prototype.updateState = function updateState(state) {
  if (!(this as any).docView) {
    //return; // This prevents the matchesNode error on hot reloads
  }
  // (this as any).updateStateInner(state, this.state.plugins != state.plugins); //eslint-disable-line
  oldUpdateState.call(this, state);
};

import React from 'react';
import { render } from 'react-dom';
import App from './app';
import _api from './api';

import './assets/Inter-roman.var.woff2';
import './assets/Inter-italic.var.woff2';
import './assets/SourceCodePro-VariableFont_wght-subset.woff2';

import './styles/index.css';

const IS_MOCK =
  import.meta.env.MODE === 'mock' || import.meta.env.MODE === 'staging';

if (IS_MOCK) {
  window.ship = 'finned-palmer';
  window.our = '~finned-palmer';
}

window.our = `~${window.ship}`;

const root = document.getElementById('app') as HTMLElement;
render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  root
);
