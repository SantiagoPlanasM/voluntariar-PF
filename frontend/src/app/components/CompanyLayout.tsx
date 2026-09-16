import { Outlet } from 'react-router';
import { CompanyBottomNav } from './CompanyBottomNav';
import { CompanySidebarNav } from './CompanySidebarNav';
import { AuthModal } from './AuthModal';
import { ChatbotWidget } from './ChatbotWidget';

export function CompanyLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <CompanySidebarNav />
      <div className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0">
        <Outlet />
      </div>
      <CompanyBottomNav />
      <AuthModal />
      <ChatbotWidget />
    </div>
  );
}
