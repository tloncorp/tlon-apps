import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './app';

/**
 * This is the entrypoint for the "web" part of our editor that will be built with vite
 */
const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
