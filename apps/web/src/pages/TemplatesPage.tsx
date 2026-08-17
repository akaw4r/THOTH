import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  TagsInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  OWASP_FAMILIES,
  OWASP_FAMILY_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  type FindingTemplateDto,
  type OwaspFamily,
  type Severity,
} from '@thoth/shared';
import {
  useCreateTemplate,
  useDeleteTemplate,
  useOwaspCategories,
  useTemplates,
  useUpdateTemplate,
} from '../api/hooks';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { CvssField, SeverityBadge } from '../components/common';
import { useAuth } from '../auth/AuthContext';

const EMPTY: Partial<FindingTemplateDto> = {
  title: '',
  severity: 'INFO',
  cvssVector: '',
  descriptionMd: '',
  impactMd: '',
  recommendationMd: '',
  referencesMd: '',
  tags: [],
  owaspCategoryId: null,
};

export function TemplatesPage() {
  const { data: templates } = useTemplates();
  const { data: owaspCategories } = useOwaspCategories();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const del = useDeleteTemplate();

  // Options grouped by family (Web / API / LLM) for the OWASP category Select.
  const owaspOptions = OWASP_FAMILIES.map((family) => ({
    group: OWASP_FAMILY_LABELS[family],
    items: (owaspCategories ?? [])
      .filter((c) => c.family === family)
      .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
  }));
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'AUTHOR';
  const [editing, setEditing] = useState<Partial<FindingTemplateDto> | null>(null);

  // Library filters (client-side), in a hierarchical cascade:
  // Framework → OWASP category → Subcategory. 'NONE' = unclassified.
  const [familyFilter, setFamilyFilter] = useState<OwaspFamily | 'NONE' | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null); // owaspCategoryId
  const [subcategoryFilter, setSubcategoryFilter] = useState<string | null>(null); // template id
  const [severityFilter, setSeverityFilter] = useState<Severity | null>(null);

  // OWASP categories available in the filter, grouped by family and restricted to
  // the selected framework (respects the hierarchy; 'NONE' has no categories).
  const categoryFilterOptions = OWASP_FAMILIES.filter((f) => !familyFilter || familyFilter === f)
    .map((family) => ({
      group: OWASP_FAMILY_LABELS[family],
      items: (owaspCategories ?? [])
        .filter((c) => c.family === family)
        .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    }))
    .filter((g) => g.items.length > 0);

  // Subcategories (vectors) of the selected OWASP category — each template is a
  // subcategory. Without a chosen category, the filter stays disabled.
  const subcategoryFilterOptions = categoryFilter
    ? (templates ?? [])
        .filter((t) => t.owaspCategoryId === categoryFilter)
        .map((t) => ({ value: t.id, label: t.title }))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  // Switching frameworks invalidates incompatible category/subcategory selections.
  const onFamilyChange = (v: string | null) => {
    const fam = v as OwaspFamily | 'NONE' | null;
    setFamilyFilter(fam);
    if (
      fam === 'NONE' ||
      (fam && owaspCategories?.find((c) => c.id === categoryFilter)?.family !== fam)
    ) {
      setCategoryFilter(null);
      setSubcategoryFilter(null);
    }
  };

  // Choosing a category aligns the framework (hierarchy) and resets the subcategory.
  const onCategoryChange = (v: string | null) => {
    setCategoryFilter(v);
    setSubcategoryFilter(null);
    const fam = owaspCategories?.find((c) => c.id === v)?.family;
    if (fam) setFamilyFilter(fam);
  };

  const filtered = (templates ?? []).filter((t) => {
    const familyOk =
      !familyFilter ||
      (familyFilter === 'NONE' ? !t.owaspCategory : t.owaspCategory?.family === familyFilter);
    const categoryOk = !categoryFilter || t.owaspCategoryId === categoryFilter;
    const subcategoryOk = !subcategoryFilter || t.id === subcategoryFilter;
    const severityOk = !severityFilter || t.severity === severityFilter;
    return familyOk && categoryOk && subcategoryOk && severityOk;
  });

  const save = async () => {
    if (!editing?.title) return;
    const payload = { ...editing, cvssVector: editing.cvssVector || null };
    if (editing.id) await update.mutateAsync(payload as never);
    else await create.mutateAsync(payload);
    notifications.show({ message: 'Template saved', color: 'green' });
    setEditing(null);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Template Library</Title>
        {canEdit && (
          <Button
            leftSection={<IconPlus size={18} />}
            color="brandGreen"
            onClick={() => setEditing(EMPTY)}
          >
            New template
          </Button>
        )}
      </Group>

      <Group align="flex-start" gap="md">
        <Select
          label="Framework"
          placeholder="All"
          clearable
          w={220}
          value={familyFilter}
          onChange={onFamilyChange}
          data={[
            ...OWASP_FAMILIES.map((f) => ({ value: f, label: OWASP_FAMILY_LABELS[f] })),
            { value: 'NONE', label: 'Unclassified' },
          ]}
        />
        {/* OWASP category and, below it, the dependent Subcategory (hierarchy). */}
        <Stack gap="xs" w={320}>
          <Select
            label="OWASP category"
            placeholder="All"
            clearable
            searchable
            value={categoryFilter}
            onChange={onCategoryChange}
            data={categoryFilterOptions}
          />
          <Select
            label="Subcategory"
            placeholder={categoryFilter ? 'All' : 'Select a category'}
            clearable
            searchable
            disabled={!categoryFilter}
            value={subcategoryFilter}
            onChange={setSubcategoryFilter}
            data={subcategoryFilterOptions}
          />
        </Stack>
        <Select
          label="Severity"
          placeholder="All"
          clearable
          w={170}
          value={severityFilter}
          onChange={(v) => setSeverityFilter(v as Severity | null)}
          data={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))}
        />
        <Text size="sm" c="dimmed" mt={30}>
          {filtered.length} of {templates?.length ?? 0}
        </Text>
      </Group>

      <Card withBorder p={0}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th w={120}>Severity</Table.Th>
              <Table.Th w={140}>OWASP</Table.Th>
              <Table.Th>Tags</Table.Th>
              <Table.Th w={90} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No templates match the filters.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {filtered.map((t) => (
              <Table.Tr key={t.id}>
                <Table.Td>{t.title}</Table.Td>
                <Table.Td>
                  <SeverityBadge severity={t.severity} />
                </Table.Td>
                <Table.Td>
                  {t.owaspCategory ? (
                    <Text size="xs" title={t.owaspCategory.name}>
                      {t.owaspCategory.code}
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {t.tags.join(', ')}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {canEdit && (
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon variant="subtle" onClick={() => setEditing(t)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => confirm('Remove template?') && del.mutate(t.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit template' : 'New template'}
        size="xl"
      >
        {editing && (
          <Stack>
            <TextInput
              label="Title"
              required
              value={editing.title ?? ''}
              onChange={(e) => setEditing({ ...editing, title: e.currentTarget.value })}
            />
            <Group grow>
              <Select
                label="Severity"
                value={editing.severity}
                onChange={(v) =>
                  setEditing({ ...editing, severity: v as FindingTemplateDto['severity'] })
                }
                data={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))}
              />
              <TagsInput
                label="Tags"
                value={editing.tags ?? []}
                onChange={(tags) => setEditing({ ...editing, tags })}
              />
            </Group>
            <Select
              label="OWASP category"
              placeholder="Unclassified"
              clearable
              searchable
              value={editing.owaspCategoryId ?? null}
              onChange={(v) => setEditing({ ...editing, owaspCategoryId: v })}
              data={owaspOptions}
            />
            <CvssField
              value={editing.cvssVector ?? ''}
              onChange={(v) => setEditing({ ...editing, cvssVector: v })}
            />
            <Text size="sm" fw={600}>
              Description
            </Text>
            <MarkdownEditor
              value={editing.descriptionMd ?? ''}
              onChange={(v) => setEditing({ ...editing, descriptionMd: v })}
              minHeight={140}
            />
            <Text size="sm" fw={600}>
              Recommendation
            </Text>
            <MarkdownEditor
              value={editing.recommendationMd ?? ''}
              onChange={(v) => setEditing({ ...editing, recommendationMd: v })}
              minHeight={140}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button color="brandGreen" disabled={!editing.title} onClick={save}>
                Save
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
