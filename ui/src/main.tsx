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
  import.meta.env.MODE === 'mock' ||
  import.meta.env.MODE === 'staging' ||
  import.meta.env.MODE === 'chatstaging' ||
  import.meta.env.MODE === 'chatmock';

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
