import {
  AppShell,
  ActionIcon,
  Box,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  SegmentedControl,
  Text,
  Menu,
  Avatar,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useUiTheme, type UiTheme } from '../theme/ui-theme';
import {
  IconChartBar,
  IconFolders,
  IconTemplate,
  IconPalette,
  IconUsers,
  IconKey,
  IconHistory,
  IconShieldLock,
  IconLogout,
  IconUserCog,
  IconSparkles,
} from '@tabler/icons-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAiStatus } from '../api/hooks';
import { AiChatDrawer } from './AiChatDrawer';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  AUTHOR: 'Pentester',
  VIEWER: 'Viewer',
};

export function Layout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [chatOpened, { open: openChat, close: closeChat }] = useDisclosure(false);
  const { user, logout } = useAuth();
  const { theme: uiTheme, setTheme: setUiTheme } = useUiTheme();
  const { data: aiStatus } = useAiStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const nav = (to: string, label: string, icon: React.ReactNode) => (
    <NavLink
      component={Link}
      to={to}
      label={label}
      leftSection={icon}
      active={location.pathname === to || location.pathname.startsWith(to + '/')}
      onClick={() => mobileOpened && toggleMobile()}
    />
  );

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            <Tooltip label={desktopOpened ? 'Collapse menu' : 'Expand menu'} position="right">
              <Burger
                opened={desktopOpened}
                onClick={toggleDesktop}
                visibleFrom="sm"
                size="sm"
                aria-label="Collapse or expand the sidebar"
              />
            </Tooltip>
            <IconShieldLock size={24} color="var(--mantine-color-brandGreen-6)" />
            <Text fw={800} size="lg">
              THOTH
            </Text>
          </Group>
          <Group gap="sm">
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="xs">
                    <Avatar color="brandGreen" radius="xl" size="sm">
                      {user?.name?.[0]?.toUpperCase() ?? '?'}
                    </Avatar>
                    <div style={{ lineHeight: 1.1 }}>
                      <Text size="sm" fw={600} visibleFrom="sm">
                        {user?.name}
                      </Text>
                      <Text size="xs" c="dimmed" visibleFrom="sm">
                        {user ? ROLE_LABELS[user.role] : ''}
                      </Text>
                    </div>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user?.email}</Menu.Label>
                <Box px="sm" py={6}>
                  <Text size="xs" c="dimmed" mb={4}>
                    Theme
                  </Text>
                  <SegmentedControl
                    fullWidth
                    size="xs"
                    value={uiTheme}
                    onChange={(v) => setUiTheme(v as UiTheme)}
                    data={[
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                      { value: 'grey', label: 'Grey' },
                    ]}
                  />
                </Box>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconUserCog size={16} />}
                  onClick={() => navigate('/account')}
                >
                  My account / MFA
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={() => logout().then(() => navigate('/login'))}
                >
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea>
          {nav('/dashboard', 'Dashboard', <IconChartBar size={18} />)}
          {nav('/projects', 'Projects', <IconFolders size={18} />)}
          {nav('/templates', 'Templates', <IconTemplate size={18} />)}
          {isAdmin && nav('/designs', 'Report Designs', <IconPalette size={18} />)}
          {isAdmin && nav('/users', 'Users', <IconUsers size={18} />)}
          {isAdmin && nav('/access', 'Grant access', <IconKey size={18} />)}
          {isAdmin && nav('/audit', 'Audit', <IconHistory size={18} />)}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      {aiStatus?.enabled && (
        <>
          <Tooltip label="Thoth Assistant" position="left" withArrow>
            <ActionIcon
              variant="filled"
              color="grape"
              radius="xl"
              size={52}
              onClick={chatOpened ? closeChat : openChat}
              aria-label="Open Thoth Assistant"
              style={{
                position: 'fixed',
                right: 16,
                bottom: 20,
                zIndex: 1000,
                boxShadow: 'var(--mantine-shadow-lg)',
              }}
            >
              <IconSparkles size={24} />
            </ActionIcon>
          </Tooltip>
          <AiChatDrawer opened={chatOpened} onClose={closeChat} />
        </>
      )}
    </AppShell>
  );
}
