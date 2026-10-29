// Configuración (DESIGN.md → Configuración): cuenta, apariencia y "más". Es la casa de lo que antes estaba en el
// medio del perfil (CV, borrar cuenta) y de "Cerrar sesión", que estaba suelto en cada pantalla.
// Los interruptores de avisos necesitan una tabla de preferencias en el backend: mientras no exista, no se muestran.
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useTheme, ThemeChoice } from '../../lib/useTheme';
import { CvSection } from './CvSection';
import { DeleteAccountSection } from './DeleteAccountSection';
import { PasswordSection } from './PasswordSection';
import { useConfirm } from '../ui/UiProvider';

const THEMES: { key: ThemeChoice; label: string }[] = [
  { key: 'system', label: 'Automático' },
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Oscuro' },
];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold text-ink-soft">{title}</h2>
      <div className="rounded-xl bg-surface border border-hairline overflow-hidden">{children}</div>
    </section>
  );
}

export function SettingsScreen() {
  const { user, logout, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { choice, setChoice } = useTheme();
  const back = user?.role === 'ngo' ? '/ngo/profile' : user?.role === 'company' ? '/company/profile' : '/profile';

  const handleLogout = async () => {
    const ok = await confirm({ title: '¿Cerrar sesión?', confirmLabel: 'Cerrar sesión', cancelLabel: 'Volver' });
    if (!ok) return;
    logout();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-canvas-soft flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[15px] text-ink-soft">Iniciá sesión para ver tu configuración.</p>
        <button type="button" onClick={() => openAuthModal()} className="h-10 px-4 rounded-[10px] bg-ink text-on-ink text-[15px] font-bold">Iniciar sesión</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas-soft pb-8">
      <div className="max-w-[560px] mx-auto px-4 pt-2 md:pt-8 flex flex-col gap-5">
        <header className="flex items-center gap-1 -ml-3">
          <Link to={back} aria-label="Volver" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-soft">
            <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <h1 className="text-[22px] font-bold tracking-[-0.3px]">Configuración</h1>
        </header>

        {user.role === 'volunteer' && <CvSection userId={user.id} />}
        {user.role === 'ngo' && (
          <Link to="/ngo/profile#mercadopago" className="rounded-xl bg-surface border border-hairline min-h-[52px] px-4 flex items-center justify-between text-[15px] hover:bg-surface-soft">
            Cuenta de Mercado Pago<ChevronRight size={18} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
          </Link>
        )}

        <Group title="Apariencia">
          <div className="p-3">
            <div role="radiogroup" aria-label="Tema" className="h-10 p-1 rounded-[10px] bg-surface-soft flex">
              {THEMES.map(t => (
                <button key={t.key} type="button" role="radio" aria-checked={choice === t.key} onClick={() => setChoice(t.key)}
                  className={`flex-1 rounded-lg text-[13px] transition-colors ${choice === t.key ? 'bg-surface font-bold text-ink' : 'font-semibold text-ink-soft'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </Group>

        <Group title="Más">
          <Link to="/privacidad" className="min-h-[52px] px-4 flex items-center justify-between text-[15px] hover:bg-surface-soft">
            Privacidad y términos<ChevronRight size={18} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
          </Link>
          <button type="button" onClick={handleLogout} className="w-full min-h-[52px] px-4 flex items-center text-left text-[15px] font-semibold border-t border-hairline hover:bg-surface-soft">
            Cerrar sesión
          </button>
        </Group>

        <PasswordSection />
        <DeleteAccountSection />
      </div>
    </div>
  );
}
