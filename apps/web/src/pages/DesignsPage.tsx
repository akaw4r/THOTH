import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { IconPlus, IconEdit } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { DesignDto } from '@thoth/shared';
import { useCreateDesign, useDesigns, useUpdateDesign } from '../api/hooks';

const EMPTY: Partial<DesignDto> = {
  name: '',
  description: '',
  htmlTemplate: '<section><h1>{{project.name}}</h1></section>',
  css: 'h1 { color: #0da65c; }',
  headerTemplate: '',
  footerTemplate: '',
};

export function DesignsPage() {
  const { data: designs } = useDesigns();
  const create = useCreateDesign();
  const update = useUpdateDesign();
  const [editing, setEditing] = useState<Partial<DesignDto> | null>(null);

  const save = async () => {
    if (!editing?.name) return;
    if (editing.id) await update.mutateAsync(editing as never);
    else await create.mutateAsync(editing);
    notifications.show({ message: 'Design saved', color: 'green' });
    setEditing(null);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Report Designs</Title>
        <Button
          leftSection={<IconPlus size={18} />}
          color="brandGreen"
          onClick={() => setEditing(EMPTY)}
        >
          New design
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        HTML/CSS templates rendered to PDF by the worker. Handlebars variables:{' '}
        <code>{'{{project.name}}'}</code>, <code>{'{{#each findings}}'}</code>,{' '}
        <code>{'{{{descriptionHtml}}}'}</code> etc.
      </Text>

      <Card withBorder p={0}>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th w={100}>Default</Table.Th>
              <Table.Th w={60} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {designs?.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td fw={600}>{d.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {d.description}
                  </Text>
                </Table.Td>
                <Table.Td>{d.isDefault && <Badge color="brandGreen">Default</Badge>}</Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<IconEdit size={14} />}
                    onClick={() => setEditing(d)}
                  >
                    Edit
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit design' : 'New design'}
        size="xl"
      >
        {editing && (
          <Stack>
            <TextInput
              label="Name"
              required
              value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.currentTarget.value })}
            />
            <TextInput
              label="Description"
              value={editing.description ?? ''}
              onChange={(e) => setEditing({ ...editing, description: e.currentTarget.value })}
            />
            <Textarea
              label="HTML template (Handlebars)"
              autosize
              minRows={6}
              maxRows={16}
              styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
              value={editing.htmlTemplate ?? ''}
              onChange={(e) => setEditing({ ...editing, htmlTemplate: e.currentTarget.value })}
            />
            <Textarea
              label="CSS"
              autosize
              minRows={6}
              maxRows={16}
              styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
              value={editing.css ?? ''}
              onChange={(e) => setEditing({ ...editing, css: e.currentTarget.value })}
            />
            <Group grow>
              <Textarea
                label="Header (PDF HTML)"
                autosize
                minRows={2}
                styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
                value={editing.headerTemplate ?? ''}
                onChange={(e) => setEditing({ ...editing, headerTemplate: e.currentTarget.value })}
              />
              <Textarea
                label="Footer (PDF HTML)"
                autosize
                minRows={2}
                styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
                value={editing.footerTemplate ?? ''}
                onChange={(e) => setEditing({ ...editing, footerTemplate: e.currentTarget.value })}
              />
            </Group>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button color="brandGreen" disabled={!editing.name} onClick={save}>
                Save
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
