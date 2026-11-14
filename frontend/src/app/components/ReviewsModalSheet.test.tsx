// src/app/components/ReviewsModalSheet.test.tsx — T9 de la revisión contra DESIGN.md (§340).
//
// Las reseñas pasan a la hoja común (`Sheet`: hoja inferior en el celular, diálogo en escritorio) y al contenido que
// pide el diseño: "Reseñas de personas que participaron", cada una con "Participó en <voluntariado> · <mes y año>",
// sin el chip "Excelente / Muy bueno", sin colores fijos y con un solo "Cerrar".
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { auth } = vi.hoisted(() => ({
  auth: { user: { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' } as Record<string, unknown> | null, openAuthModal: vi.fn() },
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, api: { ...actual.api, projects: { ...actual.api.projects, get: vi.fn(), rate: vi.fn() } } };
});

import { api } from '../../lib/api';
import { ReviewsModal } from './ReviewsModal';

const juan = { id: 'r1', user_id: 'u-juan', user_name: 'Juan Pérez', rating: 5, comment: 'Me encantó', created_at: '2026-10-10 12:00:00' };
const ana = { id: 'r2', user_id: 'u-ana', user_name: 'Ana Gómez', rating: 4, comment: '', created_at: 'sin fecha' };

const open = (props: Partial<Parameters<typeof ReviewsModal>[0]> = {}) => render(
  <MemoryRouter>
    <ReviewsModal isOpen onClose={() => {}} projectId="proj-1" projectTitle="Reforestación Urbana" {...props} />
  </MemoryRouter>,
);

beforeEach(() => {
  vi.mocked(api.projects.get).mockReset().mockResolvedValue({ project: { avg_rating: 4.5, ratings: [juan, ana] } } as never);
  vi.mocked(api.projects.rate).mockReset();
  auth.user = { id: 'u-vol', name: 'María', email: 'm@x.com', role: 'volunteer' };
});

describe('<ReviewsModal />: la hoja de reseñas', () => {
  test('se llama "Reseñas", dice de qué voluntariado son y tiene un solo "Cerrar"', async () => {
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas' });
    expect(within(d).getByRole('heading', { level: 2, name: 'Reseñas' })).toBeInTheDocument();
    expect(within(d).getAllByRole('button', { name: 'Cerrar' })).toHaveLength(1);
  });

  test('el promedio va en grande con la cantidad, sin el chip "Excelente / Muy bueno"', async () => {
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas' });
    expect(await within(d).findByText('4,5')).toBeInTheDocument();
    expect(within(d).getByText('2 reseñas en total')).toBeInTheDocument();
    for (const chip of ['Excelente', 'Muy bueno', 'Aceptable', 'Sin calificar']) expect(within(d).queryByText(chip)).toBeNull();
  });

  test('la lista se titula "Reseñas de personas que participaron"', async () => {
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas' });
    expect(within(d).getByRole('heading', { level: 3, name: 'Reseñas de personas que participaron' })).toBeInTheDocument();
    expect(within(d).queryByText('Todas las reseñas')).toBeNull();
  });

  test('cada reseña dice "Participó en <voluntariado> · <mes y año>"; sin fecha válida, solo el voluntariado', async () => {
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas' });
    const deJuan = (await within(d).findByText('Juan Pérez')).closest('li')!;
    expect(deJuan).toHaveTextContent('Participó en Reforestación Urbana · octubre 2026');
    expect(within(deJuan).getByText('Me encantó')).toBeInTheDocument();
    const deAna = within(d).getByText('Ana Gómez').closest('li')!;
    expect(deAna).toHaveTextContent('Participó en Reforestación Urbana');
    expect(deAna).not.toHaveTextContent('·');
  });

  test('las estrellas de cada reseña se leen como "5 de 5"', async () => {
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas' });
    const deJuan = (await within(d).findByText('Juan Pérez')).closest('li')!;
    expect(within(deJuan).getByRole('img', { name: '5 de 5' })).toBeInTheDocument();
    expect(within(within(d).getByText('Ana Gómez').closest('li')!).getByRole('img', { name: '4 de 5' })).toBeInTheDocument();
  });

  test('las estrellas del promedio van redondeadas: 2 y 3 dan 2,5 y se leen "3 de 5"', async () => {
    vi.mocked(api.projects.get).mockResolvedValue({ project: { avg_rating: 2.5, ratings: [{ ...juan, rating: 2 }, { ...ana, rating: 3 }] } } as never);
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas' });
    expect(await within(d).findByText('2,5')).toBeInTheDocument();
    // La del promedio y la de la reseña de 3; la de 2, una sola.
    expect(within(d).getAllByRole('img', { name: '3 de 5' })).toHaveLength(2);
    expect(within(d).getAllByRole('img', { name: '2 de 5' })).toHaveLength(1);
  });

  test('quien calificó sin foto va con sus iniciales (Avatar)', async () => {
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas' });
    await within(d).findByText('Juan Pérez');
    expect([...d.querySelectorAll('[data-initial]')].map(el => el.textContent)).toEqual(['JP', 'AG']);
  });

  test('sin colores fijos: ningún color en hexadecimal ni de la paleta vieja', async () => {
    open({ canRate: true });
    const d = await screen.findByRole('dialog', { name: 'Reseñas' });
    await within(d).findByText('Juan Pérez');
    const classes = [...d.querySelectorAll('[class]')].map(el => el.getAttribute('class')).join(' ');
    expect(classes).not.toMatch(/#[0-9a-f]{6}/i);
    expect(classes).not.toMatch(/(amber|yellow|gray|emerald|red)-\d/);
  });

  test('mientras carga sin nada para mostrar: esqueleto con nombre, no un spinner', async () => {
    vi.mocked(api.projects.get).mockReturnValue(new Promise(() => {}));
    open();
    const d = await screen.findByRole('dialog', { name: 'Reseñas' });
    const cargando = within(d).getByRole('status', { name: 'Cargando reseñas' });
    expect(cargando.querySelector('.skeleton')).not.toBeNull();
    expect(d.querySelector('.animate-spin')).toBeNull();
  });

  test('guardar la reseña avisa con role="status" y el botón dice "Guardando…" mientras tanto', async () => {
    let done: (v: unknown) => void = () => {};
    vi.mocked(api.projects.rate).mockReturnValue(new Promise(r => { done = r; }) as never);
    open({ canRate: true });
    const d = await screen.findByRole('dialog', { name: 'Reseñas' });
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Publicar reseña' })).toBeEnabled());
    fireEvent.click(within(d).getByRole('button', { name: 'Publicar reseña' }));
    expect(await within(d).findByRole('button', { name: 'Guardando…' })).toBeDisabled();
    done({ message: 'ok' });
    expect(await within(d).findByRole('status')).toHaveTextContent('Tu reseña se guardó');
  });

  test('cerrada no dibuja nada', () => {
    open({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.projects.get).not.toHaveBeenCalled();
  });
});
