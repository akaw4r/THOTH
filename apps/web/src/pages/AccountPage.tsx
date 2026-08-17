import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Image,
  PinInput,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconFingerprint, IconTrash, IconShieldCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { startRegistration } from '@simplewebauthn/browser';
import QRCode from 'qrcode';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface Credentials {
  totpEnrolled: boolean;
  webauthn: Array<{ id: string; name: string; createdAt: string; lastUsedAt: string | null }>;
}

export function AccountPage() {
  const { user, refresh } = useAuth();
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [totpQr, setTotpQr] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get<Credentials>('/account/mfa/credentials').then(setCreds);

  useEffect(() => {
    load();
  }, []);

  const beginTotp = async () => {
    const res = await api.get<{ secret: string; otpauthUrl: string }>('/account/mfa/totp/setup');
    setTotpSecret(res.secret);
    setTotpQr(await QRCode.toDataURL(res.otpauthUrl, { margin: 1, width: 200 }));
  };

  const enrollTotp = async () => {
    setBusy(true);
    try {
      await api.post('/account/mfa/totp/enroll', { code });
      notifications.show({ message: 'TOTP enabled', color: 'green' });
      setTotpQr('');
      setTotpSecret('');
      setCode('');
      await load();
      await refresh();
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
      notifications.show({ message: 'Passkey registered', color: 'green' });
      await load();
      await refresh();
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Error', color: 'red' });
    }
  };

  const removePasskey = async (id: string) => {
    await api.del(`/account/mfa/webauthn/${id}`);
    await load();
  };

  return (
    <Stack maw={640}>
      <Title order={2}>My account</Title>
      <Card withBorder>
        <Group>
          <div>
            <Text fw={600}>{user?.name}</Text>
            <Text size="sm" c="dimmed">
              {user?.email}
            </Text>
          </div>
          {user?.mfaEnrolled && (
            <Badge color="green" variant="light" leftSection={<IconShieldCheck size={14} />}>
              MFA enabled
            </Badge>
          )}
        </Group>
      </Card>

      <Card withBorder>
        <Stack>
          <Title order={4}>Authenticator (TOTP)</Title>
          <Text size="sm" c="dimmed">
            We recommend <b>Google Authenticator</b> to generate the codes (scan the QR code with
            the app).
          </Text>
          {creds?.totpEnrolled ? (
            <Badge color="green" variant="light">
              TOTP configured
            </Badge>
          ) : totpQr ? (
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
                Confirm
              </Button>
            </Stack>
          ) : (
            <Group>
              <Button variant="light" onClick={beginTotp}>
                Set up TOTP
              </Button>
            </Group>
          )}
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Group justify="space-between">
            <Title order={4}>Passkeys (WebAuthn)</Title>
            <Button
              variant="light"
              leftSection={<IconFingerprint size={16} />}
              onClick={addPasskey}
            >
              Add passkey
            </Button>
          </Group>
          <Divider />
          <Table>
            <Table.Tbody>
              {creds?.webauthn.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.name}</Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      created {new Date(c.createdAt).toLocaleDateString('en-US')}
                    </Text>
                  </Table.Td>
                  <Table.Td w={40}>
                    <ActionIcon color="red" variant="subtle" onClick={() => removePasskey(c.id)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {creds?.webauthn.length === 0 && (
                <Table.Tr>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      No passkeys registered.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card>
    </Stack>
  );
}
