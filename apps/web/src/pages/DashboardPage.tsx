import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Center,
  Grid,
  Group,
  Loader,
  MultiSelect,
  RingProgress,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { DonutChart, LineChart } from '@mantine/charts';
import { IconFileTypePdf, IconFilterOff, IconPrinter } from '@tabler/icons-react';
import {
  FINDING_STATUS_LABELS,
  OWASP_FAMILY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  SEVERITIES,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  type DashboardMetrics,
} from '@thoth/shared';
import { api } from '../api/client';
import { useDashboard, useProjects, type DashboardFilters } from '../api/hooks';

/**
 * Chart colors validated for color blindness (dataviz skill script):
 * color-identified series use palettes with approved CVD separation; where the
 * axis already names the bar, color is reinforcement and values are labeled directly.
 */
const FAMILY_COLORS: Record<string, string> = { WEB: '#2563eb', API: '#e8590c', LLM: '#0ca678' };
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#868e96',
  IN_REVIEW: '#e8590c',
  FINAL: '#0ca678',
};
const TREND_TOTAL = '#0ca678';
const TREND_GRAVE = '#dc2626';

const GRADE_COLORS: Record<DashboardMetrics['risk']['grade'], string> = {
  A: 'teal',
  B: 'green',
  C: 'yellow',
  D: 'orange',
  E: 'red',
  F: 'red',
};

const EMPTY_FILTERS: DashboardFilters = { projectIds: [], severities: [], from: '', to: '' };

/** Horizontal bar list with direct label and value (prints well). */
function BarList({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Stack gap={8}>
      {items.map((i) => (
        <Group key={i.label} gap="sm" wrap="nowrap">
          <Text size="sm" w={110} style={{ flexShrink: 0 }}>
            {i.label}
          </Text>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: `${(i.value / max) * 100}%`,
                minWidth: i.value > 0 ? 8 : 0,
                height: 18,
                borderRadius: 4,
                background: i.color,
                transition: 'width 200ms ease',
              }}
            />
          </div>
          <Text size="sm" fw={700} w={36} ta="right" style={{ flexShrink: 0 }}>
            {i.value}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

export function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const { data, isLoading } = useDashboard(filters);
  const { data: projects } = useProjects();

  const hasFilters =
    filters.projectIds.length > 0 || filters.severities.length > 0 || filters.from || filters.to;

  if (isLoading && !data) {
    return (
      <Center h={300}>
        <Loader color="brandGreen" />
      </Center>
    );
  }
  if (!data) return null;

  const severityData = SEVERITIES.map((s) => ({
    label: SEVERITY_LABELS[s],
    value: data.severityCounts[s],
    color: SEVERITY_COLORS[s],
  }));

  const statusData = Object.entries(data.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: FINDING_STATUS_LABELS[k as keyof typeof FINDING_STATUS_LABELS],
      value: v,
      color: STATUS_COLORS[k],
    }));

  const familyData = Object.entries(data.familyCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: OWASP_FAMILY_LABELS[k as keyof typeof OWASP_FAMILY_LABELS],
      value: v,
      color: FAMILY_COLORS[k],
    }));

  const pipelineData = PROJECT_STATUSES.map((s) => ({
    label: PROJECT_STATUS_LABELS[s],
    value: data.projectPipeline[s],
    color: 'var(--mantine-color-brandGreen-6)',
  }));

  const trendData = data.trend.map((t) => ({
    month: t.month,
    Total: t.total,
    'Critical + High': t.criticalHigh,
  }));

  return (
    <Stack className="dashboard-print-root">
      <Group justify="space-between" className="no-print">
        <Title order={2}>Dashboard</Title>
        <Tooltip label="Generates a PDF of the dashboard with the current filters (print → save as PDF)">
          <Button
            variant="light"
            leftSection={<IconPrinter size={16} />}
            onClick={() => window.print()}
          >
            Download PDF
          </Button>
        </Tooltip>
      </Group>

      {/* Header shown only when printing */}
      <div className="print-only">
        <Title order={2}>THOTH — Offensive Security Dashboard</Title>
        <Text size="sm" c="dimmed">
          Generated on {new Date().toLocaleString('en-US')}
          {hasFilters ? ' (with filters applied)' : ''}
        </Text>
      </div>

      {/* Filters */}
      <Card withBorder className="no-print">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <MultiSelect
            label="Projects"
            placeholder={filters.projectIds.length ? undefined : 'All'}
            data={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={filters.projectIds}
            onChange={(v) => setFilters((f) => ({ ...f, projectIds: v }))}
            searchable
            clearable
            w={260}
          />
          <MultiSelect
            label="Severities"
            placeholder={filters.severities.length ? undefined : 'All'}
            data={SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))}
            value={filters.severities}
            onChange={(v) => setFilters((f) => ({ ...f, severities: v }))}
            clearable
            w={220}
          />
          <TextInput
            label="From"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.currentTarget.value }))}
          />
          <TextInput
            label="To"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.currentTarget.value }))}
          />
          {hasFilters && (
            <Button
              variant="subtle"
              leftSection={<IconFilterOff size={16} />}
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear
            </Button>
          )}
        </Group>
      </Card>

      {/* 1. Executive overview */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 4, lg: 3 }}>
          <Card withBorder h="100%">
            <Stack gap={4} align="center" justify="center" h="100%">
              <Tooltip
                multiline
                w={280}
                label="Score = 100 − accumulated penalty of the findings in the filter (Critical −15, High −8, Medium −3, Low −1, Info 0), floored at 0."
              >
                <RingProgress
                  size={140}
                  thickness={12}
                  roundCaps
                  sections={[{ value: data.risk.score, color: GRADE_COLORS[data.risk.grade] }]}
                  label={
                    <Center>
                      <Stack gap={0} align="center">
                        <Text fw={800} size="xl">
                          {data.risk.score}
                        </Text>
                        <Badge color={GRADE_COLORS[data.risk.grade]} variant="light">
                          {data.risk.grade}
                        </Badge>
                      </Stack>
                    </Center>
                  }
                />
              </Tooltip>
              <Text fw={600}>Risk score</Text>
              <Text size="xs" c="dimmed" ta="center">
                {data.totals.findings} findings across {data.totals.projects} projects
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 8, lg: 5 }}>
          <Card withBorder h="100%">
            <Text fw={600} mb="md">
              Distribution by severity
            </Text>
            <BarList items={severityData} />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card withBorder h="100%">
            <Text fw={600} mb="xs">
              Finding status
            </Text>
            {statusData.length ? (
              <Group justify="center">
                <DonutChart
                  data={statusData}
                  withLabels
                  withLabelsLine
                  paddingAngle={2}
                  tooltipDataSource="segment"
                  size={170}
                  thickness={26}
                />
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                No findings in the current filter.
              </Text>
            )}
            <Group gap="md" justify="center" mt="xs">
              {statusData.map((s) => (
                <Group key={s.name} gap={6}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                  <Text size="xs">
                    {s.name} ({s.value})
                  </Text>
                </Group>
              ))}
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* 2. Vulnerability profile */}
      <Grid>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card withBorder h="100%">
            <Text fw={600} mb="xs">
              Top OWASP categories
            </Text>
            {data.topOwasp.length ? (
              <Table striped highlightOnHover>
                <Table.Tbody>
                  {data.topOwasp.map((o) => (
                    <Table.Tr key={o.code}>
                      <Table.Td w={90}>
                        <Badge variant="light" color={FAMILY_COLORS[o.family]} radius="sm">
                          {o.code}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {o.name}
                        </Text>
                      </Table.Td>
                      <Table.Td w={50} ta="right">
                        <Text size="sm" fw={700}>
                          {o.count}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text size="sm" c="dimmed">
                No findings classified with an OWASP category in the filter.
              </Text>
            )}
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 7, lg: 4 }}>
          <Card withBorder h="100%">
            <Text fw={600} mb="xs">
              Most critical assets
            </Text>
            {data.topAssets.length ? (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Asset</Table.Th>
                    <Table.Th ta="right">Crit.+High</Table.Th>
                    <Table.Th ta="right">Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.topAssets.map((a) => (
                    <Table.Tr key={a.asset}>
                      <Table.Td>
                        <Text size="sm" lineClamp={1} style={{ wordBreak: 'break-all' }}>
                          {a.asset}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" fw={700} c={a.criticalHigh ? 'red' : undefined}>
                          {a.criticalHigh}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">{a.total}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text size="sm" c="dimmed">
                No affected assets recorded in the filter.
              </Text>
            )}
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 5, lg: 3 }}>
          <Card withBorder h="100%">
            <Text fw={600} mb="xs">
              Distribution by scope (OWASP)
            </Text>
            {familyData.length ? (
              <>
                <Group justify="center">
                  <DonutChart
                    data={familyData}
                    withLabels
                    withLabelsLine
                    paddingAngle={2}
                    tooltipDataSource="segment"
                    size={150}
                    thickness={24}
                  />
                </Group>
                <Group gap="md" justify="center" mt="xs">
                  {familyData.map((s) => (
                    <Group key={s.name} gap={6}>
                      <div
                        style={{ width: 10, height: 10, borderRadius: 2, background: s.color }}
                      />
                      <Text size="xs">
                        {s.name} ({s.value})
                      </Text>
                    </Group>
                  ))}
                </Group>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                No OWASP classification in the filter.
              </Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* 4. Operational */}
      <Grid>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card withBorder h="100%">
            <Text fw={600} mb="md">
              Pentest pipeline
            </Text>
            <BarList items={pipelineData} />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card withBorder h="100%">
            <Text fw={600} mb="xs">
              Trend — new findings per month (12 months)
            </Text>
            <LineChart
              h={220}
              data={trendData}
              dataKey="month"
              series={[
                { name: 'Total', color: TREND_TOTAL },
                { name: 'Critical + High', color: TREND_GRAVE },
              ]}
              curveType="monotone"
              withLegend
              withDots
              strokeWidth={2}
            />
          </Card>
        </Grid.Col>
      </Grid>

      <Card withBorder>
        <Text fw={600} mb="xs">
          Recent reports
        </Text>
        {data.recentReports.length ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Project</Table.Th>
                <Table.Th>File</Table.Th>
                <Table.Th>Generated</Table.Th>
                <Table.Th className="no-print" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.recentReports.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>{r.projectName}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {r.filename}
                    </Text>
                  </Table.Td>
                  <Table.Td>{new Date(r.createdAt).toLocaleString('en-US')}</Table.Td>
                  <Table.Td w={140} className="no-print">
                    <Button
                      size="compact-sm"
                      variant="light"
                      leftSection={<IconFileTypePdf size={14} />}
                      onClick={() =>
                        api.download(`/projects/${r.projectId}/reports/${r.id}/download`)
                      }
                    >
                      Download PDF
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed">
            No PDF reports completed yet.
          </Text>
        )}
      </Card>
    </Stack>
  );
}
