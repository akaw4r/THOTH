import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Image,
  PasswordInput,
  PinInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconKey, IconAlertTriangle, IconFingerprint } from '@tabler/icons-react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import QRCode from 'qrcode';
import { useNavigate } from 'react-router-dom';
import type { LocalLoginResponse, LocalLoginStep } from '@thoth/shared';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/**
 * Local admin break-glass flow (undisclosed route /auth/local).
 * State machine: password → password change → MFA setup → verification → app.
 */
export function LocalLoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState<LocalLoginStep | 'login'>('login');
  const [methods, setMethods] = useState<Array<'totp' | 'webauthn'>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // password change
  const [newPassword, setNewPassword] = useState('');
  // totp
  const [totpQr, setTotpQr] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    document.title = 'THOTH — Administrative access';
    api.me().catch(() => undefined); // ensures cookie + CSRF token
  }, []);

  const advance = async (res: LocalLoginResponse) => {
    setCode('');
    setMethods(res.methods ?? []);
    if (res.step === 'authenticated') {
      await refresh();
      navigate('/projects', { replace: true });
      return;
    }
    setStep(res.step);
    if (res.step === 'mfa_setup_required') await beginTotpSetup();
  };

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unexpected error');
    } finally {
      setBusy(false);
    }
  };

  const doLogin = () =>
    wrap(async () => {
      const res = await api.post<LocalLoginResponse>('/auth/local/login', { username, password });
      await advance(res);
    });

  const doChangePassword = () =>
    wrap(async () => {
      const res = await api.post<LocalLoginResponse>('/auth/local/password', { newPassword });
      await advance(res);
    });

  const beginTotpSetup = async () => {
    const res = await api.get<{ secret: string; otpauthUrl: string }>('/auth/local/mfa/totp/setup');
    setTotpSecret(res.secret);
    setTotpQr(await QRCode.toDataURL(res.otpauthUrl, { margin: 1, width: 200 }));
  };

  const doTotpEnroll = () =>
    wrap(async () => {
      const res = await api.post<LocalLoginResponse>('/auth/local/mfa/totp/enroll', { code });
      await advance(res);
    });

  const doTotpVerify = () =>
    wrap(async () => {
      const res = await api.post<LocalLoginResponse>('/auth/local/mfa/totp', { code });
      await advance(res);
    });

  const doWebauthnSetup = () =>
    wrap(async () => {
      const options = await api.get('/auth/local/mfa/webauthn/setup');
      const attResp = await startRegistration({ optionsJSON: options as never });
      const res = await api.post<LocalLoginResponse>('/auth/local/mfa/webauthn/enroll', {
        response: attResp,
        name: 'Break-glass passkey',
      });
      await advance(res);
    });

  const doWebauthnVerify = () =>
    wrap(async () => {
      const options = await api.get('/auth/local/mfa/webauthn/options');
      const authResp = await startAuthentication({ optionsJSON: options as never });
      const res = await api.post<LocalLoginResponse>('/auth/local/mfa/webauthn', {
        response: authResp,
      });
      await advance(res);
    });

  return (
    <Center h="100vh" p="md" style={{ background: '#10231b' }}>
      <Card shadow="xl" radius="lg" p="xl" w={420} maw="100%">
        <Stack>
          <Group gap="xs">
            <IconKey size={28} color="var(--mantine-color-brandGreen-6)" />
            <div>
              <Title order={3}>Administrative access</Title>
              <Text size="xs" c="dimmed">
                Break-glass local account · restricted use
              </Text>
            </div>
          </Group>

          <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
            Use this access only when Google sign-in is unavailable. Every action is audited.
          </Alert>

          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}

          {step === 'login' && (
            <Stack>
              <TextInput
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                autoComplete="username"
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                autoComplete="current-password"
              />
              <Button color="brandGreen" loading={busy} onClick={doLogin}>
                Sign in
              </Button>
            </Stack>
          )}

          {step === 'password_change_required' && (
            <Stack>
              <Text size="sm">Set a new password (minimum 12 characters) to continue.</Text>
              <PasswordInput
                label="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.currentTarget.value)}
                autoComplete="new-password"
              />
              <Button
                color="brandGreen"
                loading={busy}
                disabled={newPassword.length < 12}
                onClick={doChangePassword}
              >
                Save and continue
              </Button>
            </Stack>
          )}

          {step === 'mfa_setup_required' && (
            <Stack align="center">
              <Text size="sm" ta="center">
                Set up the required MFA. Scan the QR code with your authenticator app (TOTP) and
                confirm the code, or register a passkey.
              </Text>
              {totpQr && <Image src={totpQr} w={200} h={200} alt="TOTP QR code" />}
              {totpSecret && (
                <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                  Secret: {totpSecret}
                </Text>
              )}
              <PinInput length={6} type="number" value={code} onChange={setCode} oneTimeCode />
              <Button
                color="brandGreen"
                fullWidth
                loading={busy}
                disabled={code.length !== 6}
                onClick={doTotpEnroll}
              >
                Confirm TOTP
              </Button>
              <Divider label="or" w="100%" />
              <Button
                variant="light"
                fullWidth
                leftSection={<IconFingerprint size={18} />}
                onClick={doWebauthnSetup}
              >
                Register passkey (WebAuthn)
              </Button>
            </Stack>
          )}

          {step === 'mfa_required' && (
            <Stack align="center">
              <Text size="sm" ta="center">
                Confirm your identity with a second factor.
              </Text>
              {methods.includes('totp') && (
                <>
                  <PinInput length={6} type="number" value={code} onChange={setCode} oneTimeCode />
                  <Button
                    color="brandGreen"
                    fullWidth
                    loading={busy}
                    disabled={code.length !== 6}
                    onClick={doTotpVerify}
                  >
                    Verify code
                  </Button>
                </>
              )}
              {methods.includes('webauthn') && (
                <Button
                  variant="light"
                  fullWidth
                  leftSection={<IconFingerprint size={18} />}
                  onClick={doWebauthnVerify}
                >
                  Use passkey
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </Card>
    </Center>
  );
}
