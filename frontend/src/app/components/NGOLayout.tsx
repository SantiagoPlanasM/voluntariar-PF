import { Outlet } from 'react-router';
import { NGOBottomNav } from './NGOBottomNav';
import { NGOSidebarNav } from './NGOSidebarNav';
import { AuthModal } from './AuthModal';
import { ChatbotWidget, ChatbotSpacer } from './ChatbotWidget';
import { RequireRole } from './RequireRole';

export function NGOLayout() {
  // Solo para su rol: con otro rol o sin sesión redirige (§97).
  return (
    <RequireRole role="ngo">
    {/* flex-shrink-0: #root es un flex en columna; sin esto el layout se encogía al alto de la pantalla y lo
        último quedaba debajo de la barra inferior y del botón del chatbot (§128). */}
    <div className="min-h-screen bg-gray-50 flex flex-shrink-0">
      <NGOSidebarNav />
      <div className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0">
        <Outlet />
        <ChatbotSpacer />
      </div>
      <NGOBottomNav />
      <AuthModal />
      <ChatbotWidget />
    </div>
    </RequireRole>
  );
}
