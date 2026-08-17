import { useState } from 'react';
import {
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import type { ProjectDto } from '@thoth/shared';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '@thoth/shared';
import { useDeleteProject, useUpdateProject } from '../../api/hooks';

export function SettingsTab({ project }: { project: ProjectDto }) {
  const update = useUpdateProject(project.id);
  const del = useDeleteProject();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: project.name,
    client: project.client,
    scope: project.scope,
    status: project.status as string,
    startDate: project.startDate ?? '',
    endDate: project.endDate ?? '',
    reportDate: project.reportDate ?? '',
    techLead: project.techLead ?? '',
  });

  const save = async () => {
    await update.mutateAsync({
      ...form,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      reportDate: form.reportDate || null,
    } as never);
    notifications.show({ message: 'Project updated', color: 'green' });
  };

  const remove = async () => {
    if (!confirm(`Delete project "${project.name}" and all of its data?`)) return;
    await del.mutateAsync(project.id);
    navigate('/projects');
  };

  return (
    <Stack maw={640}>
      <Card withBorder>
        <Stack>
          <TextInput
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
          <TextInput
            label="Client / Business unit"
            value={form.client}
            onChange={(e) => setForm({ ...form, client: e.currentTarget.value })}
          />
          <Group grow>
            <TextInput
              type="date"
              label="Start date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.currentTarget.value })}
            />
            <TextInput
              type="date"
              label="End date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.currentTarget.value })}
            />
          </Group>
          <Group grow>
            <TextInput
              type="date"
              label="Report date"
              description="Shown on the cover (default: end date)"
              value={form.reportDate}
              onChange={(e) => setForm({ ...form, reportDate: e.currentTarget.value })}
            />
            <TextInput
              label="Technical lead"
              description="Shown on the report cover"
              value={form.techLead}
              onChange={(e) => setForm({ ...form, techLead: e.currentTarget.value })}
            />
          </Group>
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v ?? 'PLANNED' })}
            data={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
          />
          <Textarea
            label="Scope"
            autosize
            minRows={3}
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.currentTarget.value })}
          />
          <Group justify="flex-end">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              color="brandGreen"
              loading={update.isPending}
              onClick={save}
            >
              Save changes
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder style={{ borderColor: 'var(--mantine-color-red-4)' }}>
        <Stack>
          <Title order={5} c="red">
            Danger zone
          </Title>
          <Text size="sm" c="dimmed">
            Deletion permanently removes this project's findings, sections, reports, and
            attachments.
          </Text>
          <Group>
            <Button
              color="red"
              variant="light"
              leftSection={<IconTrash size={16} />}
              onClick={remove}
            >
              Delete project
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
