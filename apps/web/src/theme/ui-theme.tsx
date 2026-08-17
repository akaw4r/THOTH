import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// Three themes: light, dark, and grey (graphite). "grey" runs on Mantine's dark
// scheme with a grey `dark` palette — light text, so always readable.
export type UiTheme = 'light' | 'dark' | 'grey';

const STORAGE_KEY = 'thoth-theme';

function readInitial(): UiTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'grey') return v;
  } catch {
    /* localStorage unavailable — use the default */
  }
  return 'light';
}

const UiThemeContext = createContext<{ theme: UiTheme; setTheme: (t: UiTheme) => void }>({
  theme: 'light',
  setTheme: () => {},
});

/**
 * Holds the (persisted) theme choice and exposes it via render-prop to configure
 * the MantineProvider, plus context for the theme selector anywhere.
 */
export function UiThemeProvider({ children }: { children: (theme: UiTheme) => ReactNode }) {
  const [theme, setThemeState] = useState<UiTheme>(readInitial);
  const setTheme = useCallback((t: UiTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <UiThemeContext.Provider value={{ theme, setTheme }}>{children(theme)}</UiThemeContext.Provider>
  );
}

export const useUiTheme = () => useContext(UiThemeContext);
