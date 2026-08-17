import { useState } from 'react';
import {
  Badge,
  Card,
  Code,
  Group,
  Pagination,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useAudit } from '../api/hooks';

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const { data } = useAudit({
    page,
    action: action || undefined,
    actorEmail: actorEmail || undefined,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Stack>
      <Title order={2}>Audit Log</Title>
      <Text size="sm" c="dimmed">
        Append-only record of all sensitive actions (authentication, CRUD, exports).
      </Text>
      <Group>
        <TextInput
          placeholder="Filter by action (e.g. auth.local)"
          leftSection={<IconSearch size={16} />}
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.currentTarget.value);
          }}
          w={280}
        />
        <TextInput
          placeholder="Filter by email"
          leftSection={<IconSearch size={16} />}
          value={actorEmail}
          onChange={(e) => {
            setPage(1);
            setActorEmail(e.currentTarget.value);
          }}
          w={240}
        />
      </Group>

      <Card withBorder p={0}>
        <Table verticalSpacing="xs" fz="sm" striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={170}>When</Table.Th>
              <Table.Th w={200}>Action</Table.Th>
              <Table.Th>Actor</Table.Th>
              <Table.Th w={130}>IP</Table.Th>
              <Table.Th>Target</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.items.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>
                  <Text size="xs">{new Date(row.createdAt).toLocaleString('en-US')}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    variant="light"
                    color={
                      row.action.includes('failure') || row.action.includes('denied')
                        ? 'red'
                        : 'gray'
                    }
                  >
                    {row.action}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{row.actorEmail ?? '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {row.ip ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {row.entityType && (
                    <Code>
                      {row.entityType}:{row.entityId?.slice(0, 8)}
                    </Code>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
      <Group justify="center">
        <Pagination value={page} onChange={setPage} total={totalPages} color="brandGreen" />
      </Group>
    </Stack>
  );
}
