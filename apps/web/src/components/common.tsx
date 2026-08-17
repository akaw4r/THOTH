import {
  Badge,
  Group,
  Input,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  FINDING_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  evaluateCvssVector,
  parseCvssVector,
  type CvssMetrics,
  type FindingStatus,
  type ProjectStatus,
  type Severity,
} from '@thoth/shared';

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge
      styles={{ root: { backgroundColor: SEVERITY_COLORS[severity], color: '#fff' } }}
      radius="sm"
    >
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: FindingStatus }) {
  const color = status === 'FINAL' ? 'green' : status === 'IN_REVIEW' ? 'yellow' : 'gray';
  return (
    <Badge variant="light" color={color} radius="sm">
      {FINDING_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const color =
    status === 'COMPLETED'
      ? 'green'
      : status === 'IN_PROGRESS'
        ? 'blue'
        : status === 'REPORTING'
          ? 'grape'
          : status === 'ARCHIVED'
            ? 'gray'
            : 'yellow';
  return (
    <Badge variant="light" color={color} radius="sm">
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

// CVSS v3.1 base metrics, in vector order, with human-readable labels.
type CvssMetricKey = keyof CvssMetrics;
const CVSS_METRICS: ReadonlyArray<{
  key: CvssMetricKey;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}> = [
  {
    key: 'AV',
    label: 'Attack vector (AV)',
    options: [
      { value: 'N', label: 'Network' },
      { value: 'A', label: 'Adjacent' },
      { value: 'L', label: 'Local' },
      { value: 'P', label: 'Physical' },
    ],
  },
  {
    key: 'AC',
    label: 'Complexity (AC)',
    options: [
      { value: 'L', label: 'Low' },
      { value: 'H', label: 'High' },
    ],
  },
  {
    key: 'PR',
    label: 'Privileges (PR)',
    options: [
      { value: 'N', label: 'None' },
      { value: 'L', label: 'Low' },
      { value: 'H', label: 'High' },
    ],
  },
  {
    key: 'UI',
    label: 'User interaction (UI)',
    options: [
      { value: 'N', label: 'None' },
      { value: 'R', label: 'Required' },
    ],
  },
  {
    key: 'S',
    label: 'Scope (S)',
    options: [
      { value: 'U', label: 'Unchanged' },
      { value: 'C', label: 'Changed' },
    ],
  },
  {
    key: 'C',
    label: 'Confidentiality (C)',
    options: [
      { value: 'H', label: 'High' },
      { value: 'L', label: 'Low' },
      { value: 'N', label: 'None' },
    ],
  },
  {
    key: 'I',
    label: 'Integrity (I)',
    options: [
      { value: 'H', label: 'High' },
      { value: 'L', label: 'Low' },
      { value: 'N', label: 'None' },
    ],
  },
  {
    key: 'A',
    label: 'Availability (A)',
    options: [
      { value: 'H', label: 'High' },
      { value: 'L', label: 'Low' },
      { value: 'N', label: 'None' },
    ],
  },
];

// Baseline used when there is no vector yet: maximum exploitability, zero impact
// (score 0.0). Picking any metric builds the full vector from here.
const DEFAULT_METRICS: CvssMetrics = {
  AV: 'N',
  AC: 'L',
  PR: 'N',
  UI: 'N',
  S: 'U',
  C: 'N',
  I: 'N',
  A: 'N',
};

function buildVector(m: CvssMetrics): string {
  return `CVSS:3.1/AV:${m.AV}/AC:${m.AC}/PR:${m.PR}/UI:${m.UI}/S:${m.S}/C:${m.C}/I:${m.I}/A:${m.A}`;
}

/**
 * CVSS v3.1 calculator: selectors for the 8 base metrics that build the vector,
 * plus a text field (paste/edit) and the live score/severity. The emitted value
 * (`onChange`) is still the vector string.
 */
export function CvssField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const evaluated = value ? evaluateCvssVector(value) : null;
  const invalid = value.length > 0 && !evaluated;
  const metrics = parseCvssVector(value) ?? DEFAULT_METRICS;

  const setMetric = (key: CvssMetricKey, v: string) => {
    onChange(buildVector({ ...metrics, [key]: v }));
  };

  return (
    <Stack gap="xs">
      <TextInput
        label="CVSS v3.1 vector"
        description="Build it with the metrics below or paste/edit the vector directly."
        placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        error={invalid ? 'Invalid CVSS vector' : undefined}
        rightSectionWidth={120}
        rightSection={
          evaluated ? (
            <Tooltip label={`Severity ${SEVERITY_LABELS[evaluated.severity]}`}>
              <Group gap={4} wrap="nowrap">
                <Text size="xs" fw={700}>
                  {evaluated.score.toFixed(1)}
                </Text>
                <SeverityBadge severity={evaluated.severity} />
              </Group>
            </Tooltip>
          ) : null
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" verticalSpacing="xs">
        {CVSS_METRICS.map((metric) => (
          <Input.Wrapper key={metric.key} label={metric.label} size="xs">
            <SegmentedControl
              fullWidth
              size="xs"
              value={metrics[metric.key]}
              onChange={(v) => setMetric(metric.key, v)}
              data={[...metric.options]}
            />
          </Input.Wrapper>
        ))}
      </SimpleGrid>

      {evaluated && (
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            Base Score:
          </Text>
          <Text size="sm" fw={700}>
            {evaluated.score.toFixed(1)}
          </Text>
          <SeverityBadge severity={evaluated.severity} />
        </Group>
      )}
    </Stack>
  );
}
