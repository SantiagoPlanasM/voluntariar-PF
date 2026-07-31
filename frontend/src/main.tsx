import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './lib/AuthContext';
import { router } from './app/routes';
import './styles/index.css';
import './styles/tailwind.css';
import './styles/theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
);
