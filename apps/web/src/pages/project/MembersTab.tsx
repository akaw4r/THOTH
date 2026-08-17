import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconTrash, IconUserPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { PROJECT_ROLES } from '@thoth/shared';
import { useProject, useRemoveMember, useUpsertMember, useUsers } from '../../api/hooks';

const PROJECT_ROLE_LABELS: Record<string, string> = {
  MANAGER: 'Manager',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
};

export function MembersTab({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const { data: users } = useUsers();
  const upsert = useUpsertMember(projectId);
  const removeMember = useRemoveMember(projectId);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('EDITOR');

  const memberIds = new Set(project?.members?.map((m) => m.userId));
  const candidates = (users ?? []).filter((u) => !memberIds.has(u.id));

  const add = async () => {
    const mail = email.trim();
    if (!userId && !mail) return;
    try {
      await upsert.mutateAsync(mail ? { email: mail, role } : { userId: userId!, role });
      setUserId(null);
      setEmail('');
      notifications.show({ message: 'Member added', color: 'green' });
    } catch {
      notifications.show({
        message: 'Failed to add. Check the email (allowed domain).',
        color: 'red',
      });
    }
  };

  return (
    <Stack>
      <Card withBorder>
        <Group align="flex-end">
          <Select
            label="Existing user"
            placeholder="Select"
            searchable
            clearable
            w={260}
            value={userId}
            onChange={(v) => {
              setUserId(v);
              if (v) setEmail('');
            }}
            data={candidates.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
          />
          <TextInput
            label="or email (Google)"
            placeholder="person@example.com"
            w={240}
            value={email}
            onChange={(e) => {
              setEmail(e.currentTarget.value);
              if (e.currentTarget.value) setUserId(null);
            }}
          />
          <Select
            label="Project role"
            w={160}
            value={role}
            onChange={(v) => setRole(v ?? 'EDITOR')}
            data={PROJECT_ROLES.map((r) => ({ value: r, label: PROJECT_ROLE_LABELS[r] }))}
          />
          <Button
            leftSection={<IconUserPlus size={16} />}
            color="brandGreen"
            disabled={!userId && !email.trim()}
            loading={upsert.isPending}
            onClick={add}
          >
            Add
          </Button>
        </Group>
      </Card>

      <Card withBorder p={0}>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th w={180}>Role</Table.Th>
              <Table.Th w={60} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {project?.members?.map((m) => (
              <Table.Tr key={m.userId}>
                <Table.Td>{m.user.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {m.user.email}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    value={m.role}
                    onChange={(v) => v && upsert.mutateAsync({ userId: m.userId, role: v })}
                    data={PROJECT_ROLES.map((r) => ({ value: r, label: PROJECT_ROLE_LABELS[r] }))}
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => removeMember.mutateAsync(m.userId)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
