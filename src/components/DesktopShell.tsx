import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, List, Plus, UserCog, Shield, LogOut, Store, Megaphone } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';

/**
 * DesktopShell
 * - Em telas md+ renderiza uma sidebar fixa profissional à esquerda.
 * - Em telas menores (mobile/tablet) NÃO renderiza nada extra: o filho aparece como está.
 * Uso: envolver páginas logadas. O conteúdo recebe padding-left automático no desktop.
 */
export function DesktopShell({ children }: { children: ReactNode }) {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const navItems = [
    { to: '/dashboard', label: 'Painel', icon: LayoutDashboard },
    { to: '/create-ad', label: 'Novo anúncio', icon: Plus },
    { to: '/my-ads', label: 'Meus anúncios', icon: List },
    { to: '/edit-profile', label: 'Meu cadastro', icon: UserCog },
  ];

  const storeHandle = currentUser?.store_slug || currentUser?.user_id;

  return (
    <>
      {/* Sidebar - somente desktop */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-64 z-30 bg-card border-r border-border flex-col">
        <div className="px-5 py-5 border-b border-border">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2.5 group">
            <img src={logo} alt="AnunciaAI" className="w-10 h-10" />
            <div className="text-left">
              <p className="text-base font-bold leading-none">
                <span className="text-cta">Anuncia</span>AI
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                Painel do anunciante
              </p>
            </div>
          </button>
        </div>

        {currentUser && (
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            {currentUser.avatar_url ? (
              <img src={currentUser.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-sm">
                {currentUser.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{currentUser.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {currentUser.store_name || 'Anunciante'}
              </p>
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Menu
          </p>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-cta/10 text-cta'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}

          {storeHandle && (
            <NavLink
              to={`/loja/${storeHandle}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
            >
              <Store className="w-4 h-4" />
              Minha loja pública
            </NavLink>
          )}

          {currentUser?.is_admin && (
            <>
              <p className="px-3 pt-5 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Administração
              </p>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-cta/10 text-cta'
                      : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <Shield className="w-4 h-4" />
                Painel admin
              </NavLink>
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-border space-y-1">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
          >
            <Megaphone className="w-4 h-4" />
            Ver marketplace
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo: padding-left no desktop para acomodar a sidebar */}
      <div className="md:pl-64">{children}</div>
    </>
  );
}
