import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';

import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';

const root = createRoot(document.getElementById('root')!);
root.render(
    <React.StrictMode>
        <GlobalErrorBoundary>
            <App />
        </GlobalErrorBoundary>
    </React.StrictMode>
);
