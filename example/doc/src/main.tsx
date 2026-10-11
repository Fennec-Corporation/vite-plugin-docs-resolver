import React from 'react';
import { createRoot } from 'react-dom/client';
import ButtonDoc from './Button.mdx';
import './style.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <main className="doc-container">
        <ButtonDoc />
      </main>
    </React.StrictMode>
  );
}
