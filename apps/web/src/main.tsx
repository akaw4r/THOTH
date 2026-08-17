import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme, type MantineColorsTuple } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './styles.css';
import { AuthProvider } from './auth/AuthContext';
import { UiThemeProvider } from './theme/ui-theme';
import { App } from './App';

const brandGreen: MantineColorsTuple = [
  '#e6f7ee',
  '#c6ecd6',
  '#9fdcb9',
  '#71cd99',
  '#4dc07f',
  '#2fb86d',
  '#0da65c',
  '#0a9450',
  '#087a43',
  '#045f33',
];

// "Grey" palette: graphite-grey ramp (light→dark). Replaces Mantine's `dark`
// when the Grey theme is active — light text (index 0), medium-grey background (7),
// intermediate borders (4/5), no contrast collisions.
const greyDark: MantineColorsTuple = [
  '#f5f6f7',
  '#e0e2e5',
  '#c2c6cc',
  '#9aa0a8',
  '#767c85',
  '#5a606a',
  '#4a4f58',
  '#3d424a',
  '#2f333a',
  '#23262b',
];

const baseTheme = createTheme({
  primaryColor: 'brandGreen',
  colors: { brandGreen },
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
});

const greyTheme = createTheme({
  primaryColor: 'brandGreen',
  colors: { brandGreen, dark: greyDark },
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UiThemeProvider>
      {(uiTheme) => (
        <MantineProvider
          theme={uiTheme === 'grey' ? greyTheme : baseTheme}
          forceColorScheme={uiTheme === 'light' ? 'light' : 'dark'}
        >
          <Notifications position="top-right" />
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </MantineProvider>
      )}
    </UiThemeProvider>
  </React.StrictMode>,
);
