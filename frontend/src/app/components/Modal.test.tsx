// src/app/components/Modal.test.tsx
//
// <Modal> común (REVISION F12): los modales no tenían role="dialog", no cerraban con Escape y el foco
// quedaba detrás del overlay (con teclado o lector de pantalla se seguía navegando la página de atrás).
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Modal } from './Modal';

function Opener({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <button>Otro de la página</button>
      {open && (
        <Modal label="Prueba" onClose={() => { onClose(); setOpen(false); }}>
          <button>Primero</button>
          <input aria-label="Medio" />
          <button>Último</button>
        </Modal>
      )}
    </>
  );
}

describe('<Modal />', () => {
  test('es un diálogo modal con nombre accesible (label o labelledBy)', () => {
    const { rerender } = render(<Modal label="Seguidores" onClose={() => {}}><p>x</p></Modal>);
    const d = screen.getByRole('dialog', { name: 'Seguidores' });
    expect(d).toHaveAttribute('aria-modal', 'true');

    rerender(<Modal labelledBy="t" onClose={() => {}}><h2 id="t">Dejar reseña</h2></Modal>);
    expect(screen.getByRole('dialog', { name: 'Dejar reseña' })).toBeInTheDocument();
  });

  test('Escape cierra, aunque el foco no esté adentro', () => {
    const onClose = vi.fn();
    render(<Modal label="M" onClose={onClose}><button>a</button></Modal>);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clic en el fondo cierra; clic adentro no', () => {
    const onClose = vi.fn();
    render(<Modal label="M" onClose={onClose}><button>adentro</button></Modal>);
    fireEvent.click(screen.getByText('adentro'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // SonarCloud S6848 (§234): el clic en el fondo es un atajo del mouse; con teclado se cierra con Escape. El fondo
  // se marca como presentación y el diálogo de adentro sigue siendo accesible.
  test('el fondo es solo presentación: no es interactivo para los lectores de pantalla y el diálogo sigue visible', () => {
    render(<Modal label="M" onClose={vi.fn()}><button>adentro</button></Modal>);
    expect(screen.getByTestId('modal-overlay')).toHaveAttribute('role', 'presentation');
    expect(screen.getByRole('dialog', { name: 'M' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'adentro' })).toBeInTheDocument();
  });

  test('closeOnOverlay={false}: el fondo no cierra (Escape sí)', () => {
    const onClose = vi.fn();
    render(<Modal label="M" onClose={onClose} closeOnOverlay={false}><p>x</p></Modal>);
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('al abrir, el foco entra al diálogo; al cerrar, vuelve al botón que lo abrió', () => {
    render(<Opener />);
    const opener = screen.getByText('Abrir');
    opener.focus();
    fireEvent.click(opener);
    const d = screen.getByRole('dialog', { name: 'Prueba' });
    expect(d.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  test('initialFocusRef: el foco va a ese elemento', () => {
    function WithRef() {
      const ref = useRef<HTMLInputElement>(null);
      return (
        <Modal label="M" onClose={() => {}} initialFocusRef={ref}>
          <button>antes</button>
          <input aria-label="Email" ref={ref} />
        </Modal>
      );
    }
    render(<WithRef />);
    expect(document.activeElement).toBe(screen.getByLabelText('Email'));
  });

  test('Tab queda atrapado adentro: del último va al primero y Shift+Tab del primero al último', () => {
    render(<Opener />);
    fireEvent.click(screen.getByText('Abrir'));
    const first = screen.getByText('Primero');
    const last = screen.getByText('Último');

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  test('Tab con el foco afuera (en la página de atrás) lo trae al diálogo', () => {
    render(<Opener />);
    fireEvent.click(screen.getByText('Abrir'));
    const outside = screen.getByText('Otro de la página');
    outside.focus();
    fireEvent.keyDown(outside, { key: 'Tab' });
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  test('con dos modales abiertos, Escape cierra solo el de arriba', () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();
    render(
      <>
        <Modal label="Abajo" onClose={closeBottom}><button>a</button></Modal>
        <Modal label="Arriba" onClose={closeTop}><button>b</button></Modal>
      </>
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBottom).not.toHaveBeenCalled();
  });

  test('bloquea el scroll del fondo y lo restaura al cerrar', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = render(<Modal label="M" onClose={() => {}}><p>x</p></Modal>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  test('sin nada enfocable adentro, Tab deja el foco en el panel', () => {
    render(<Modal label="Solo texto" onClose={() => {}}><p>Cargando…</p></Modal>);
    const d = screen.getByRole('dialog');
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    d.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(d);
  });

  // FilterModal, ProjectMap y ReviewsModal todavía escuchan Escape en window: el del modal no debe llegar.
  test('el Escape que cierra el modal no sigue hasta window', () => {
    const onWindow = vi.fn();
    window.addEventListener('keydown', onWindow);
    render(<Modal label="M" onClose={() => {}}><button>a</button></Modal>);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    window.removeEventListener('keydown', onWindow);
    expect(onWindow).not.toHaveBeenCalled();
  });
});
