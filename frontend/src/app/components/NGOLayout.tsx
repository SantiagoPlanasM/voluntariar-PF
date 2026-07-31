import { Outlet } from 'react-router';

export function NGOLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex flex-col w-full pb-16 md:pb-0">
        <Outlet />
      </div>
    </div>
  );
}
