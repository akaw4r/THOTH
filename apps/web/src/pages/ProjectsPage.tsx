import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Select,
  Center,
  Loader,
} from '@mantine/core';
import { IconPlus, IconFolders, IconLayoutGrid, IconList, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Link, useNavigate } from 'react-router-dom';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  SEVERITIES,
  SEVERITY_COLORS,
  type ProjectDto,
} from '@thoth/shared';
import { useCreateProject, useProjects } from '../api/hooks';
import { ProjectStatusBadge } from '../components/common';
import { useAuth } from '../auth/AuthContext';

type ViewMode = 'cards' | 'list';
const VIEW_KEY = 'thoth.projects.view';

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const create = useCreateProject();
  const { user } = useAuth();
  const [opened, setOpened] = useState(false);
  const [form, setForm] = useState({ name: '', client: '', scope: '', status: 'PLANNED' });
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'cards',
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string | null>(null);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'AUTHOR';

  const changeView = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const clients = useMemo(
    () => [...new Set((projects ?? []).map((p) => p.client).filter(Boolean))].sort(),
    [projects],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects ?? []).filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (clientFilter && p.client !== clientFilter) return false;
      if (q) {
        const haystack = `${p.name} ${p.client} ${p.scope}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [projects, search, statusFilter, clientFilter]);

  const submit = async () => {
    try {
      await create.mutateAsync(form as never);
      notifications.show({ message: 'Project created', color: 'green' });
      setOpened(false);
      setForm({ name: '', client: '', scope: '', status: 'PLANNED' });
    } catch (e) {
      notifications.show({ message: (e as Error).message, color: 'red' });
    }
  };

  if (isLoading) {
    return (
      <Center h={300}>
        <Loader color="brandGreen" />
      </Center>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Projects</Title>
        {canCreate && (
          <Button
            leftSection={<IconPlus size={18} />}
            color="brandGreen"
            onClick={() => setOpened(true)}
          >
            New project
          </Button>
        )}
      </Group>

      {/* Filters + cards/list toggle */}
      <Card withBorder p="sm">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by name, client, or scope…"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={280}
          />
          <Select
            placeholder="Status"
            clearable
            data={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
            value={statusFilter}
            onChange={setStatusFilter}
            w={180}
          />
          <Select
            placeholder="Client / BU"
            clearable
            searchable
            data={clients}
            value={clientFilter}
            onChange={setClientFilter}
            w={200}
          />
          <div style={{ flex: 1 }} />
          <Text size="sm" c="dimmed">
            {filtered.length} of {projects?.length ?? 0}
          </Text>
          <SegmentedControl
            size="xs"
            value={view}
            onChange={(v) => changeView(v as ViewMode)}
            data={[
              {
                value: 'cards',
                label: (
                  <Center>
                    <IconLayoutGrid size={16} />
                  </Center>
                ),
              },
              {
                value: 'list',
                label: (
                  <Center>
                    <IconList size={16} />
                  </Center>
                ),
              },
            ]}
          />
        </Group>
      </Card>

      {filtered.length === 0 && (
        <Card withBorder p="xl">
          <Center>
            <Stack align="center">
              <IconFolders size={48} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed">
                {projects?.length ? 'No projects match the filters.' : 'No projects yet.'}
              </Text>
            </Stack>
          </Center>
        </Card>
      )}

      {view === 'cards' ? (
        <Grid>
          {filtered.map((p) => (
            <Grid.Col key={p.id} span={{ base: 12, sm: 6, lg: 4 }}>
              <Card
                withBorder
                shadow="sm"
                radius="md"
                component={Link}
                to={`/projects/${p.id}`}
                h="100%"
              >
                <Stack gap="xs">
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={700} lineClamp={1}>
                      {p.name}
                    </Text>
                    <ProjectStatusBadge status={p.status} />
                  </Group>
                  {p.client && (
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {p.client}
                    </Text>
                  )}
                  <SeverityBadges project={p} />
                </Stack>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      ) : (
        filtered.length > 0 && <ProjectsTable projects={filtered} />
      )}

      <CreateProjectModal
        opened={opened}
        onClose={() => setOpened(false)}
        form={form}
        setForm={setForm}
        submit={submit}
        pending={create.isPending}
      />
    </Stack>
  );
}

/** Per-severity count badges (or "No findings"). */
function SeverityBadges({ project }: { project: ProjectDto }) {
  return (
    <Group gap={6} mt="xs">
      {SEVERITIES.map((sev) => {
        const n = project.findingCounts?.[sev] ?? 0;
        if (!n) return null;
        return (
          <Badge
            key={sev}
            size="sm"
            styles={{ root: { backgroundColor: SEVERITY_COLORS[sev], color: '#fff' } }}
          >
            {n}
          </Badge>
        );
      })}
      {!SEVERITIES.some((s) => project.findingCounts?.[s]) && (
        <Text size="xs" c="dimmed">
          No findings
        </Text>
      )}
    </Group>
  );
}

/** List view: one clickable row per project. */
function ProjectsTable({ projects }: { projects: ProjectDto[] }) {
  const navigate = useNavigate();
  return (
    <Card withBorder p={0}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Project</Table.Th>
            <Table.Th>Client / BU</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Findings</Table.Th>
            <Table.Th>Updated</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {projects.map((p) => (
            <Table.Tr
              key={p.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <Table.Td>
                <Text size="sm" fw={600} lineClamp={1}>
                  {p.name}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {p.client || '—'}
                </Text>
              </Table.Td>
              <Table.Td>
                <ProjectStatusBadge status={p.status} />
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {SEVERITIES.map((sev) => {
                    const n = p.findingCounts?.[sev] ?? 0;
                    if (!n) return null;
                    return (
                      <Badge
                        key={sev}
                        size="sm"
                        styles={{
                          root: { backgroundColor: SEVERITY_COLORS[sev], color: '#fff' },
                        }}
                      >
                        {n}
                      </Badge>
                    );
                  })}
                  {!SEVERITIES.some((s) => p.findingCounts?.[s]) && (
                    <Text size="xs" c="dimmed">
                      —
                    </Text>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {new Date(p.updatedAt).toLocaleDateString('en-US')}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

function CreateProjectModal({
  opened,
  onClose,
  form,
  setForm,
  submit,
  pending,
}: {
  opened: boolean;
  onClose: () => void;
  form: { name: string; client: string; scope: string; status: string };
  setForm: React.Dispatch<
    React.SetStateAction<{ name: string; client: string; scope: string; status: string }>
  >;
  submit: () => Promise<void>;
  pending: boolean;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="New project" size="lg">
      <Stack>
        <TextInput
          label="Name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
        />
        <TextInput
          label="Client / Business unit"
          value={form.client}
          onChange={(e) => setForm({ ...form, client: e.currentTarget.value })}
        />
        <Select
          label="Status"
          data={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
          value={form.status}
          onChange={(v) => setForm({ ...form, status: v ?? 'PLANNED' })}
        />
        <Textarea
          label="Scope"
          autosize
          minRows={3}
          value={form.scope}
          onChange={(e) => setForm({ ...form, scope: e.currentTarget.value })}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="brandGreen" loading={pending} disabled={!form.name} onClick={submit}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
