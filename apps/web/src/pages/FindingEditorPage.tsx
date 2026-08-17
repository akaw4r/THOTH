import { useEffect, useState } from 'react';
import {
  Anchor,
  Breadcrumbs,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconDeviceFloppy, IconArrowLeft, IconSparkles } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FINDING_STATUSES,
  FINDING_STATUS_LABELS,
  OWASP_FAMILIES,
  OWASP_FAMILY_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  evaluateCvssVector,
  type FindingDto,
} from '@thoth/shared';
import {
  useAiStatus,
  useFinding,
  useGenerateFindingField,
  useOwaspCategories,
  useUpdateFinding,
  type FindingAiField,
} from '../api/hooks';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { CvssField } from '../components/common';

export function FindingEditorPage() {
  const { projectId = '', findingId = '' } = useParams();
  const { data: finding, isLoading } = useFinding(projectId, findingId);
  const update = useUpdateFinding(projectId, findingId);
  const { data: owaspCategories } = useOwaspCategories();
  const navigate = useNavigate();
  const [form, setForm] = useState<FindingDto | null>(null);

  const owaspOptions = OWASP_FAMILIES.map((family) => ({
    group: OWASP_FAMILY_LABELS[family],
    items: (owaspCategories ?? [])
      .filter((c) => c.family === family)
      .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
  }));

  useEffect(() => {
    if (finding) setForm(finding);
  }, [finding]);

  if (isLoading || !form) {
    return (
      <Center h={300}>
        <Loader color="brandGreen" />
      </Center>
    );
  }

  const set = <K extends keyof FindingDto>(key: K, value: FindingDto[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    // If there is a valid CVSS vector, severity follows the computed value.
    const evaluated = form.cvssVector ? evaluateCvssVector(form.cvssVector) : null;
    await update.mutateAsync({
      title: form.title,
      severity: evaluated?.severity ?? form.severity,
      cvssVector: form.cvssVector || null,
      status: form.status,
      descriptionMd: form.descriptionMd,
      impactMd: form.impactMd,
      recommendationMd: form.recommendationMd,
      referencesMd: form.referencesMd,
      affectedAssets: form.affectedAssets,
      head: form.head,
      tribe: form.tribe,
      squad: form.squad,
      techLead: form.techLead,
      owaspCategoryId: form.owaspCategoryId,
    });
    notifications.show({ message: 'Finding saved', color: 'green' });
  };

  return (
    <Stack>
      <Breadcrumbs>
        <Anchor component={Link} to="/projects">
          Projects
        </Anchor>
        <Anchor component={Link} to={`/projects/${projectId}`}>
          Project
        </Anchor>
        <Text>{form.title}</Text>
      </Breadcrumbs>

      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            Back
          </Button>
          <Title order={3}>Edit finding</Title>
        </Group>
        <Button
          leftSection={<IconDeviceFloppy size={18} />}
          color="brandGreen"
          loading={update.isPending}
          onClick={save}
        >
          Save
        </Button>
      </Group>

      <Card withBorder>
        <Stack>
          <TextInput
            label="Title"
            required
            value={form.title}
            onChange={(e) => set('title', e.currentTarget.value)}
          />
          <Group grow>
            <Select
              label="Severity"
              value={form.severity}
              onChange={(v) => v && set('severity', v as FindingDto['severity'])}
              data={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))}
              description="Calculated automatically when a valid CVSS vector is provided"
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(v) => v && set('status', v as FindingDto['status'])}
              data={FINDING_STATUSES.map((s) => ({ value: s, label: FINDING_STATUS_LABELS[s] }))}
            />
          </Group>
          <CvssField value={form.cvssVector ?? ''} onChange={(v) => set('cvssVector', v)} />
          <Select
            label="OWASP category"
            placeholder="Unclassified"
            clearable
            searchable
            value={form.owaspCategoryId ?? null}
            onChange={(v) => set('owaspCategoryId', v)}
            data={owaspOptions}
          />
          <TagsInput
            label="Affected assets"
            placeholder="Press Enter to add (URL, host, endpoint…)"
            value={form.affectedAssets}
            onChange={(v) => set('affectedAssets', v)}
          />
          <Group grow>
            <TextInput
              label="Head"
              value={form.head}
              onChange={(e) => set('head', e.currentTarget.value)}
            />
            <TextInput
              label="Tribe"
              value={form.tribe}
              onChange={(e) => set('tribe', e.currentTarget.value)}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Squad"
              value={form.squad}
              onChange={(e) => set('squad', e.currentTarget.value)}
            />
            <TextInput
              label="Technical lead"
              value={form.techLead}
              onChange={(e) => set('techLead', e.currentTarget.value)}
            />
          </Group>
        </Stack>
      </Card>

      <FieldEditor
        label="Description"
        value={form.descriptionMd}
        onChange={(v) => set('descriptionMd', v)}
        projectId={projectId}
        findingId={findingId}
        aiField="description"
      />
      <FieldEditor
        label="Impact"
        value={form.impactMd}
        onChange={(v) => set('impactMd', v)}
        projectId={projectId}
        findingId={findingId}
        aiField="impact"
      />
      <FieldEditor
        label="Recommendation"
        value={form.recommendationMd}
        onChange={(v) => set('recommendationMd', v)}
        projectId={projectId}
        findingId={findingId}
      />
      <FieldEditor
        label="References"
        value={form.referencesMd}
        onChange={(v) => set('referencesMd', v)}
        projectId={projectId}
        findingId={findingId}
        aiField="references"
      />

      <Group justify="flex-end">
        <Button
          leftSection={<IconDeviceFloppy size={18} />}
          color="brandGreen"
          loading={update.isPending}
          onClick={save}
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
}

function FieldEditor({
  label,
  value,
  onChange,
  projectId,
  findingId,
  aiField,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  projectId: string;
  findingId: string;
  aiField?: FindingAiField;
}) {
  const { data: aiStatus } = useAiStatus();
  const generate = useGenerateFindingField(projectId, findingId);
  const canGenerate = Boolean(aiField) && aiStatus?.enabled;

  const generateField = async () => {
    if (!aiField) return;
    try {
      const { text } = await generate.mutateAsync(aiField);
      onChange(text); // replaces the draft — the user reviews and saves
      notifications.show({
        message: `${label} generated by AI. Review and save the finding.`,
        color: 'green',
      });
    } catch {
      notifications.show({ message: `Failed to generate ${label} with AI.`, color: 'red' });
    }
  };

  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={5}>{label}</Title>
          {canGenerate && (
            <Button
              size="xs"
              variant="light"
              color="grape"
              leftSection={<IconSparkles size={14} />}
              loading={generate.isPending}
              onClick={generateField}
            >
              Generate with AI (replaces the current text)
            </Button>
          )}
        </Group>
        <MarkdownEditor value={value} onChange={onChange} projectId={projectId} />
      </Stack>
    </Card>
  );
}
