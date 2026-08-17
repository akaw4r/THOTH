import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconUserPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { ROLES, type Role } from '@thoth/shared';
import { useUpdateUserRole, useUpsertUserByEmail, useUsers } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';

const ROLE_LABELS: Record<Role, string> = { ADMIN: 'Admin', AUTHOR: 'Pentester', VIEWER: 'Viewer' };

export function UsersPage() {
  const { data: users } = useUsers();
  const update = useUpdateUserRole();
  const addByEmail = useUpsertUserByEmail();
  const { user: me } = useAuth();
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<string>('VIEWER');

  const changeRole = async (id: string, role: string) => {
    await update.mutateAsync({ id, role });
    notifications.show({ message: 'Role updated', color: 'green' });
  };

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const add = async () => {
    if (!emailOk) return;
    try {
      const u = await addByEmail.mutateAsync({ email: email.trim(), role: newRole });
      setEmail('');
      notifications.show({
        message: `${u.email} set as ${ROLE_LABELS[u.role]}.`,
        color: 'green',
      });
    } catch {
      notifications.show({
        message: 'Failed to add. Check the email (allowed domain).',
        color: 'red',
      });
    }
  };

  return (
    <Stack>
      <Title order={2}>Users</Title>
      <Card withBorder>
        <Group align="flex-end">
          <TextInput
            label="Add by email (Google)"
            placeholder="person@example.com"
            w={320}
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            error={email.length > 0 && !emailOk ? 'Invalid email' : undefined}
          />
          <Select
            label="Global role"
            w={160}
            value={newRole}
            onChange={(v) => setNewRole(v ?? 'VIEWER')}
            data={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          />
          <Button
            leftSection={<IconUserPlus size={16} />}
            color="brandGreen"
            disabled={!emailOk}
            loading={addByEmail.isPending}
            onClick={add}
          >
            Add
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mt={6}>
          Pre-authorizes even users who have not signed in yet — the role applies on their first
          Google sign-in. For an admin, choose "Admin".
        </Text>
      </Card>
      <Card withBorder p={0}>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th w={160}>Global role</Table.Th>
              <Table.Th w={120}>MFA</Table.Th>
              <Table.Th w={100}>Type</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users?.map((u) => (
              <Table.Tr key={u.id}>
                <Table.Td>{u.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {u.email}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    value={u.role}
                    disabled={u.id === me?.id}
                    onChange={(v) => v && changeRole(u.id, v)}
                    data={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                  />
                </Table.Td>
                <Table.Td>
                  {u.mfaEnrolled ? (
                    <Badge color="green" variant="light">
                      Enabled
                    </Badge>
                  ) : (
                    <Badge color="gray" variant="light">
                      —
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  {u.isLocalAdmin ? (
                    <Badge color="orange" variant="light">
                      Local
                    </Badge>
                  ) : (
                    <Badge color="blue" variant="light">
                      Google
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
