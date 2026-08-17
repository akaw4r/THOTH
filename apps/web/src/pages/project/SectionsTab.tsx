import { useState } from 'react';
import { ActionIcon, Accordion, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconPlus, IconTrash, IconDeviceFloppy, IconSparkles } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { SectionDto } from '@thoth/shared';
import {
  useAiStatus,
  useCreateSection,
  useDeleteSection,
  useGenerateConclusion,
  useGenerateExecutiveSummary,
  useSections,
  useUpdateSection,
} from '../../api/hooks';
import { MarkdownEditor } from '../../components/MarkdownEditor';

function SectionRow({
  projectId,
  section,
  canEdit,
}: {
  projectId: string;
  section: SectionDto;
  canEdit: boolean;
}) {
  const update = useUpdateSection(projectId);
  const del = useDeleteSection(projectId);
  const { data: aiStatus } = useAiStatus();
  const generateSummary = useGenerateExecutiveSummary(projectId);
  const generateConclusion = useGenerateConclusion(projectId);
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.contentMd);
  const dirty = title !== section.title || content !== section.contentMd;

  // AI button on the Executive Summary and Conclusion, when the assistant is
  // configured.
  const isExecutiveSummary = section.slug === 'executive-summary';
  const isConclusion = section.slug === 'conclusion';
  const canGenerate = canEdit && (isExecutiveSummary || isConclusion) && aiStatus?.enabled;
  const generating = generateSummary.isPending || generateConclusion.isPending;

  const save = async () => {
    await update.mutateAsync({ id: section.id, title, contentMd: content });
    notifications.show({ message: 'Section saved', color: 'green' });
  };

  const generate = async () => {
    try {
      const text = isConclusion
        ? (await generateConclusion.mutateAsync()).text
        : (await generateSummary.mutateAsync()).summary;
      setContent(text); // replaces the draft — the user reviews and saves
      notifications.show({
        message: `${isConclusion ? 'Conclusion generated' : 'Executive Summary generated'} by AI. Review and save the section.`,
        color: 'green',
      });
    } catch {
      notifications.show({
        message: `Failed to generate the ${isConclusion ? 'Conclusion' : 'Executive Summary'}.`,
        color: 'red',
      });
    }
  };

  return (
    <Accordion.Item value={section.id}>
      <Accordion.Control>
        <Text fw={600}>{section.title}</Text>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack>
          <TextInput
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            disabled={!canEdit}
          />
          {canGenerate && (
            <Group>
              <Button
                variant="light"
                color="grape"
                leftSection={<IconSparkles size={16} />}
                loading={generating}
                onClick={generate}
              >
                Generate with AI from the findings
              </Button>
              <Text size="xs" c="dimmed">
                The AI analyzes the project's findings and proposes the{' '}
                {isConclusion ? 'Conclusion' : 'Executive Summary'}. The text replaces the current
                content — review before saving.
              </Text>
            </Group>
          )}
          <MarkdownEditor value={content} onChange={setContent} projectId={projectId} />
          {canEdit && (
            <Group justify="space-between">
              <ActionIcon
                color="red"
                variant="light"
                onClick={async () => {
                  if (confirm('Remove this section?')) {
                    await del.mutateAsync(section.id);
                  }
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                color="brandGreen"
                disabled={!dirty}
                loading={update.isPending}
                onClick={save}
              >
                Save section
              </Button>
            </Group>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export function SectionsTab({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data: sections } = useSections(projectId);
  const create = useCreateSection(projectId);
  const [newTitle, setNewTitle] = useState('');

  const add = async () => {
    if (!newTitle.trim()) return;
    await create.mutateAsync({ title: newTitle });
    setNewTitle('');
  };

  return (
    <Stack>
      {canEdit && (
        <Group>
          <TextInput
            placeholder="New section title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.currentTarget.value)}
            w={320}
          />
          <Button leftSection={<IconPlus size={16} />} variant="light" onClick={add}>
            Add section
          </Button>
        </Group>
      )}
      <Accordion variant="separated" multiple>
        {sections?.map((s) => (
          <SectionRow key={s.id} projectId={projectId} section={s} canEdit={canEdit} />
        ))}
      </Accordion>
    </Stack>
  );
}
