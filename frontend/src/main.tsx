import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './lib/AuthContext';
import { ChatProvider } from './lib/ChatContext';
import { router } from './app/routes';
import { UiProvider } from './app/ui/UiProvider';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ChatProvider>
        <UiProvider>
          <RouterProvider router={router} />
        </UiProvider>
      </ChatProvider>
    </AuthProvider>
  </StrictMode>
);
