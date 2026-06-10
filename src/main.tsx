import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ConfirmProvider } from './hooks/useConfirm';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ConfirmProvider>
        <App />
        <Toaster position="top-right" richColors />
      </ConfirmProvider>
    </BrowserRouter>
  </StrictMode>,
);
