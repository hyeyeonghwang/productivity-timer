import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Celebration } from './Celebration';
import './overlay.css';

const rootElement = document.getElementById('overlay-root');
if (!rootElement) {
  throw new Error('Overlay root element #overlay-root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Celebration />
  </StrictMode>,
);
