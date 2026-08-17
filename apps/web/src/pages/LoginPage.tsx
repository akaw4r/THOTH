import { useEffect } from 'react';
import { Alert, Button, Card, Center, Group, Stack, Text, Title } from '@mantine/core';
import { IconBrandGoogle, IconShieldLock, IconAlertTriangle } from '@tabler/icons-react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ERROR_MESSAGES: Record<string, string> = {
  domain_not_allowed: 'This email does not belong to an authorized domain.',
  not_authorized:
    'Your account does not have access to THOTH. Request membership in the access group.',
  google_unavailable: 'Google sign-in is currently unavailable. Contact an administrator.',
  oidc_failed: 'Google authentication failed. Please try again.',
  invalid_state: 'Login session expired. Please try again.',
};

/**
 * Main login screen — "Sign in with Google" ONLY.
 * No username/password fields. The local admin lives at the undisclosed route
 * /auth/local (there is no link to it here).
 */
export function LoginPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const errorKey = params.get('error');

  useEffect(() => {
    document.title = 'THOTH — Sign in';
  }, []);

  if (!loading && user) return <Navigate to="/projects" replace />;

  return (
    <Center h="100vh" p="md" style={{ background: '#ffffff' }}>
      <Card shadow="xl" radius="lg" p="xl" w={400} maw="100%" withBorder>
        <Stack align="center" gap="lg">
          <Group gap="xs">
            <IconShieldLock size={40} color="var(--mantine-color-brandGreen-6)" />
            <Title order={1} size="h1">
              THOTH
            </Title>
          </Group>
          <Stack gap={2} align="center">
            <Text size="sm" c="dimmed">
              Offensive Security
            </Text>
          </Stack>

          {errorKey && (
            <Alert icon={<IconAlertTriangle size={18} />} color="red" variant="light" w="100%">
              {ERROR_MESSAGES[errorKey] ?? 'Unable to sign in.'}
            </Alert>
          )}

          <Button
            component="a"
            href="/api/auth/google"
            size="md"
            fullWidth
            color="brandGreen"
            leftSection={<IconBrandGoogle size={20} />}
          >
            Sign in with Google
          </Button>

          <Text size="xs" c="dimmed" ta="center">
            Access restricted to authorized personnel. All actions are audited.
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}
