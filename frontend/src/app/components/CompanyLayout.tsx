import { Outlet } from 'react-router';
import { CompanyBottomNav } from './CompanyBottomNav';
import { CompanySidebarNav } from './CompanySidebarNav';
import { AuthModal } from './AuthModal';
import { ChatbotWidget, ChatbotSpacer } from './ChatbotWidget';
import { RequireRole } from './RequireRole';

export function CompanyLayout() {
  // Solo para su rol: con otro rol o sin sesión redirige (§97).
  return (
    <RequireRole role="company">
    {/* flex-shrink-0: ver NGOLayout (§128). */}
    <div className="min-h-screen bg-gray-50 flex flex-shrink-0">
      <CompanySidebarNav />
      <div className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0">
        <Outlet />
        <ChatbotSpacer />
      </div>
      <CompanyBottomNav />
      <AuthModal />
      <ChatbotWidget />
    </div>
    </RequireRole>
  );
}
