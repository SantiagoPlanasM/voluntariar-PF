import { Outlet } from 'react-router';
import { NGOBottomNav } from './NGOBottomNav';
import { NGOSidebarNav } from './NGOSidebarNav';
import { AuthModal } from './AuthModal';
import { ChatbotWidget } from './ChatbotWidget';
import { RequireRole } from './RequireRole';

export function NGOLayout() {
  // Solo para su rol: con otro rol o sin sesión redirige (§97).
  return (
    <RequireRole role="ngo">
    <div className="min-h-screen bg-gray-50 flex">
      <NGOSidebarNav />
      <div className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0">
        <Outlet />
      </div>
      <NGOBottomNav />
      <AuthModal />
      <ChatbotWidget />
    </div>
    </RequireRole>
  );
}
