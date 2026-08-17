import { useState } from 'react';
import {
  Button,
  Card,
  Center,
  Divider,
  Group,
  Image,
  PinInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconFingerprint, IconLogout, IconShieldLock } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { startRegistration } from '@simplewebauthn/browser';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/**
 * First access: MFA enrollment is mandatory. The backend blocks all routes
 * (403 mfa_enrollment_required) until the user registers TOTP or a passkey —
 * this screen is the only way into the application.
 */
export function MfaSetupPage() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [totpQr, setTotpQr] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    await refresh();
    navigate('/projects', { replace: true });
  };

  const beginTotp = async () => {
    try {
      const res = await api.get<{ secret: string; otpauthUrl: string }>('/account/mfa/totp/setup');
      setTotpSecret(res.secret);
      setTotpQr(await QRCode.toDataURL(res.otpauthUrl, { margin: 1, width: 200 }));
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Error', color: 'red' });
    }
  };

  const enrollTotp = async () => {
    setBusy(true);
    try {
      await api.post('/account/mfa/totp/enroll', { code });
      notifications.show({ message: 'MFA enabled. Welcome!', color: 'green' });
      await finish();
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Error', color: 'red' });
    } finally {
      setBusy(false);
    }
  };

  const addPasskey = async () => {
    try {
      const options = await api.get('/account/mfa/webauthn/setup');
      const resp = await startRegistration({ optionsJSON: options as never });
      await api.post('/account/mfa/webauthn/enroll', { response: resp, name: 'Passkey' });
      notifications.show({ message: 'MFA enabled. Welcome!', color: 'green' });
      await finish();
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Error', color: 'red' });
    }
  };

  return (
    <Center mih="100vh" p="md">
      <Card withBorder maw={440} w="100%">
        <Stack>
          <Group>
            <IconShieldLock size={28} />
            <div>
              <Title order={3}>Set up MFA</Title>
              <Text size="sm" c="dimmed">
                {user?.email}
              </Text>
            </div>
          </Group>
          <Text size="sm">
            On your first access to THOTH you must enroll a second authentication factor. Register
            an authenticator (TOTP) or a passkey to continue.
          </Text>
          <Text size="sm" c="dimmed">
            We recommend <b>Google Authenticator</b>: install the app on your phone, scan the QR
            code, and enter the generated 6-digit code.
          </Text>

          <Divider label="Authenticator (TOTP)" />
          {totpQr ? (
            <Stack align="center">
              <Image src={totpQr} w={200} h={200} alt="TOTP QR code" />
              <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                {totpSecret}
              </Text>
              <PinInput length={6} type="number" value={code} onChange={setCode} oneTimeCode />
              <Button
                color="brandGreen"
                loading={busy}
                disabled={code.length !== 6}
                onClick={enrollTotp}
              >
                Confirm and sign in
              </Button>
            </Stack>
          ) : (
            <Button variant="light" onClick={beginTotp}>
              Set up TOTP
            </Button>
          )}

          <Divider label="or" />
          <Button variant="light" leftSection={<IconFingerprint size={16} />} onClick={addPasskey}>
            Register passkey
          </Button>

          <Divider />
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconLogout size={16} />}
            onClick={() => logout()}
          >
            Sign out
          </Button>
        </Stack>
      </Card>
    </Center>
  );
}
