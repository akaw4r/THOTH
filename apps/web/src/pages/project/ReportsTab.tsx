import { useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Select, Stack, Table, Text } from '@mantine/core';
import { IconFileTypePdf, IconDownload, IconJson, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { ReportStatus } from '@thoth/shared';
import { api } from '../../api/client';
import { useDeleteReport, useDesigns, useReports, useRequestReport } from '../../api/hooks';

const STATUS: Record<ReportStatus, { label: string; color: string }> = {
  QUEUED: { label: 'Queued', color: 'gray' },
  RENDERING: { label: 'Rendering', color: 'blue' },
  DONE: { label: 'Ready', color: 'green' },
  FAILED: { label: 'Failed', color: 'red' },
};

export function ReportsTab({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data: reports } = useReports(projectId);
  const { data: designs } = useDesigns();
  const request = useRequestReport(projectId);
  const del = useDeleteReport(projectId);
  const [designId, setDesignId] = useState<string | null>(null);

  const generate = async () => {
    await request.mutateAsync(designId);
    notifications.show({ message: 'Report queued for generation', color: 'green' });
  };

  const remove = async (id: string, filename: string) => {
    if (!confirm(`Delete report "${filename}"?`)) return;
    await del.mutateAsync(id);
    notifications.show({ message: 'Report deleted', color: 'green' });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          {canEdit && (
            <>
              <Select
                placeholder="Default design"
                w={260}
                clearable
                value={designId}
                onChange={setDesignId}
                data={(designs ?? []).map((d) => ({
                  value: d.id,
                  label: d.isDefault ? `${d.name} (default)` : d.name,
                }))}
              />
              <Button
                leftSection={<IconFileTypePdf size={18} />}
                color="brandGreen"
                loading={request.isPending}
                onClick={generate}
              >
                Generate PDF
              </Button>
            </>
          )}
        </Group>
        <Button
          variant="light"
          leftSection={<IconJson size={18} />}
          onClick={() => api.download(`/projects/${projectId}/export/json`)}
        >
          Export JSON
        </Button>
      </Group>

      <Card withBorder p={0}>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>File</Table.Th>
              <Table.Th w={140}>Status</Table.Th>
              <Table.Th w={160}>Requested by</Table.Th>
              <Table.Th w={170} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {reports?.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <Text size="sm">{r.filename}</Text>
                  {r.error && (
                    <Text size="xs" c="red">
                      {r.error}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge color={STATUS[r.status].color} variant="light">
                    {STATUS[r.status].label}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {r.requestedBy?.name ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={6} wrap="nowrap" justify="flex-end">
                    {r.status === 'DONE' && (
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconDownload size={14} />}
                        onClick={() =>
                          api.download(`/projects/${projectId}/reports/${r.id}/download`)
                        }
                      >
                        Download
                      </Button>
                    )}
                    {canEdit && (
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        aria-label="Delete report"
                        loading={del.isPending}
                        onClick={() => remove(r.id, r.filename)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {reports?.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" ta="center" py="lg">
                    No reports generated yet.
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
