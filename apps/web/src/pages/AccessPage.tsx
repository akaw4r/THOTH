import { useState } from 'react';
import {
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconUserPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useGrantAccess, useProjects } from '../api/hooks';

// Requested roles: Editor = edit/create reports; Viewer = view + download (read-only).
const ROLE_OPTIONS = [
  { value: 'EDITOR', label: 'Editor — edit and create reports' },
  { value: 'VIEWER', label: 'Viewer — view and download (read-only)' },
];

export function AccessPage() {
  const { data: projects } = useProjects();
  const grant = useGrantAccess();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('VIEWER');
  const [projectIds, setProjectIds] = useState<string[]>([]);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canGrant = emailOk && projectIds.length > 0 && !grant.isPending;

  const submit = async () => {
    if (!canGrant) return;
    try {
      const res = await grant.mutateAsync({ email: email.trim(), role, projectIds });
      notifications.show({
        message: `Access granted to ${res.email} on ${res.projectCount} project(s).`,
        color: 'green',
      });
      setEmail('');
      setProjectIds([]);
    } catch {
      notifications.show({
        message: 'Failed to grant access. Check the email (allowed domain) and the projects.',
        color: 'red',
      });
    }
  };

  return (
    <Stack maw={720}>
      <Title order={2}>Grant access</Title>
      <Text c="dimmed" size="sm">
        Enter the person's Google email and role. If they have not accessed THOTH yet, access is
        pre-authorized and activates on their first sign-in. Viewer can view and download reports
        (read-only); Editor can edit and create reports. Applies to one or more projects.
      </Text>
      <Card withBorder>
        <Stack>
          <TextInput
            label="Email (Google)"
            placeholder="person@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            error={email.length > 0 && !emailOk ? 'Invalid email' : undefined}
          />
          <Select
            label="Role"
            data={ROLE_OPTIONS}
            value={role}
            onChange={(v) => setRole(v ?? 'VIEWER')}
            allowDeselect={false}
          />
          <MultiSelect
            label="Projects"
            placeholder="Select one or more projects"
            searchable
            data={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={projectIds}
            onChange={setProjectIds}
          />
          <Group justify="flex-end">
            <Button
              leftSection={<IconUserPlus size={16} />}
              color="brandGreen"
              disabled={!canGrant}
              loading={grant.isPending}
              onClick={submit}
            >
              Grant access
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
