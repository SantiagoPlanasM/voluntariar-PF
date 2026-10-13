// src/app/components/NGOSidebarNav.test.tsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { NGOSidebarNav } from './NGOSidebarNav';

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Fundación Verde', email: 'f@x.com', role: 'ngo' }, logout: vi.fn() }),
}));
vi.mock('../../lib/ChatContext', () => ({ useChat: () => ({ unreadTotal: 0 }) }));

const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><NGOSidebarNav /></MemoryRouter>);

describe('<NGOSidebarNav /> — Momentos', () => {
  test('tiene el enlace a /ngo/momentos', () => {
    renderAt('/ngo/dashboard');
    expect(screen.getByRole('link', { name: 'Momentos' })).toHaveAttribute('href', '/ngo/momentos');
  });

  test('queda resaltado solo estando en esa pantalla', () => {
    const { unmount } = renderAt('/ngo/momentos');
    expect(screen.getByRole('link', { name: 'Momentos' }).className).toContain('bg-blue-50');
    expect(screen.getByRole('link', { name: 'Dashboard' }).className).not.toContain('bg-blue-50');
    unmount();
    renderAt('/ngo/dashboard');
    expect(screen.getByRole('link', { name: 'Momentos' }).className).not.toContain('bg-blue-50');
  });
});
