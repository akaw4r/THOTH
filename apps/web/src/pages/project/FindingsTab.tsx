import { useMemo, useState } from 'react';
import { ActionIcon, Button, Card, Group, Select, Stack, Table, Text } from '@mantine/core';
import { IconPlus, IconTrash, IconTemplate, IconChevronRight } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { OWASP_FAMILIES, OWASP_FAMILY_LABELS } from '@thoth/shared';
import {
  useCreateFinding,
  useCreateFindingFromTemplate,
  useDeleteFinding,
  useFindings,
  useOwaspCategories,
  useTemplates,
} from '../../api/hooks';
import { SeverityBadge, StatusBadge } from '../../components/common';

export function FindingsTab({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data: findings } = useFindings(projectId);
  const { data: templates } = useTemplates();
  const { data: owaspCategories } = useOwaspCategories();
  const create = useCreateFinding(projectId);
  const fromTemplate = useCreateFindingFromTemplate(projectId);
  const del = useDeleteFinding(projectId);
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState<string | null>(null);

  // Template picker filters (framework = OWASP family, category = category).
  const [framework, setFramework] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const frameworkOptions = OWASP_FAMILIES.map((family) => ({
    value: family,
    label: OWASP_FAMILY_LABELS[family],
  }));

  // Categories follow the selected framework (all when none is selected).
  const categoryOptions = (owaspCategories ?? [])
    .filter((c) => !framework || c.family === framework)
    .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }));

  // Templates filtered by framework/category — feed the "Template" dropdown.
  const filteredTemplates = useMemo(
    () =>
      (templates ?? []).filter((t) => {
        if (framework && t.owaspCategory?.family !== framework) return false;
        if (category && t.owaspCategory?.id !== category) return false;
        return true;
      }),
    [templates, framework, category],
  );

  const addBlank = async () => {
    const f = await create.mutateAsync({ title: 'New finding', severity: 'INFO' } as never);
    navigate(`/projects/${projectId}/findings/${f.id}`);
  };

  const addFromTemplate = async () => {
    if (!templateId) return;
    const f = await fromTemplate.mutateAsync(templateId);
    setTemplateId(null);
    navigate(`/projects/${projectId}/findings/${f.id}`);
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this finding?')) return;
    await del.mutateAsync(id);
    notifications.show({ message: 'Finding removed', color: 'green' });
  };

  return (
    <Stack>
      {canEdit && (
        <Card withBorder p="md">
          <Group align="flex-end" gap="xs" wrap="wrap">
            <Button leftSection={<IconPlus size={16} />} color="brandGreen" onClick={addBlank}>
              New finding
            </Button>

            {/* Filters to locate the desired template. */}
            <Select
              label="Framework"
              placeholder="All frameworks"
              clearable
              w={200}
              value={framework}
              onChange={(value) => {
                setFramework(value);
                setCategory(null); // resets the dependent category
                setTemplateId(null); // template may no longer match the filter
              }}
              data={frameworkOptions}
            />
            <Select
              label="Category"
              placeholder="All categories"
              clearable
              searchable
              w={280}
              value={category}
              onChange={(value) => {
                setCategory(value);
                setTemplateId(null);
              }}
              data={categoryOptions}
            />
            <Select
              label="Template"
              placeholder="From a template…"
              w={340}
              searchable
              value={templateId}
              onChange={setTemplateId}
              data={filteredTemplates.map((t) => ({
                value: t.id,
                label: t.owaspCategory ? `${t.owaspCategory.code} · ${t.title}` : t.title,
              }))}
              nothingFoundMessage="No templates match the filters"
              leftSection={<IconTemplate size={16} />}
            />
            <Button variant="light" disabled={!templateId} onClick={addFromTemplate}>
              Insert
            </Button>
          </Group>
        </Card>
      )}

      <Card withBorder p={0}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th w={130}>OWASP</Table.Th>
              <Table.Th w={120}>Severity</Table.Th>
              <Table.Th w={80}>CVSS</Table.Th>
              <Table.Th w={120}>Status</Table.Th>
              <Table.Th w={80} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {findings?.map((f) => (
              <Table.Tr
                key={f.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/projects/${projectId}/findings/${f.id}`)}
              >
                <Table.Td>
                  <Text fw={500}>{f.title}</Text>
                </Table.Td>
                <Table.Td>
                  {f.owaspCategory ? (
                    <Text size="sm" title={f.owaspCategory.name}>
                      {f.owaspCategory.code}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <SeverityBadge severity={f.severity} />
                </Table.Td>
                <Table.Td>{f.cvssScore != null ? f.cvssScore.toFixed(1) : '—'}</Table.Td>
                <Table.Td>
                  <StatusBadge status={f.status} />
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    {canEdit && (
                      <ActionIcon color="red" variant="subtle" onClick={() => remove(f.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                    <ActionIcon
                      variant="subtle"
                      onClick={() => navigate(`/projects/${projectId}/findings/${f.id}`)}
                    >
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {findings?.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center" py="lg">
                    No findings recorded yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
