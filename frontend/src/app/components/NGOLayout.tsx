import { Outlet } from 'react-router';
import { NGOBottomNav } from './NGOBottomNav';
import { NGOSidebarNav } from './NGOSidebarNav';
import { AuthModal } from './AuthModal';

export function NGOLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <NGOSidebarNav />
      <div className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0">
        <Outlet />
      </div>
      <NGOBottomNav />
      <AuthModal />
    </div>
  );
}
