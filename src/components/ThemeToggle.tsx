import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('theme') as Theme | null;
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('theme', theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getInitial());
  useEffect(() => { applyTheme(theme); }, [theme]);
  return { theme, toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) };
}

interface Props {
  className?: string;
  variant?: 'icon' | 'full';
}

export function ThemeToggle({ className, variant = 'icon' }: Props) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'full') {
    return (
      <button
        onClick={toggle}
        aria-label="Alternar tema"
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground transition-colors',
          className,
        )}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        {isDark ? 'Tema claro' : 'Tema escuro'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label="Alternar tema"
      className={cn(
        'inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-muted text-foreground/80 transition-colors',
        className,
      )}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
