import { useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  useComputedColorScheme,
} from '@mantine/core';
import { useLocation } from 'react-router-dom';
import { IconSend, IconSparkles, IconX } from '@tabler/icons-react';
import { useAiChat } from '../api/hooks';
import { MarkdownPreview } from './MarkdownPreview';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Floating assistant panel — no longer an edge-to-edge Drawer.
 * Opens in the bottom-right corner, anchored above the floating action button
 * (FAB), sized like a chat window.
 */
export function AiChatDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  // On a project route, Thoth Assistant receives the project context (findings +
  // sections); outside it, it is the general chat.
  const { pathname } = useLocation();
  const projectId = pathname.match(/\/projects\/([0-9a-fA-F-]{36})/)?.[1];
  const chat = useAiChat(projectId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const viewport = useRef<HTMLDivElement>(null);
  // Theme is 'auto': in dark mode the bubbles follow the (dark) background with white
  // text; in light mode they keep the original light tones.
  const dark = useComputedColorScheme('light') === 'dark';
  const border = dark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-2)';

  const scrollToBottom = () =>
    requestAnimationFrame(() =>
      viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' }),
    );

  const send = async () => {
    const message = input.trim();
    if (!message || chat.isPending) return;
    const history = messages.slice(-10);
    const next = [...messages, { role: 'user', content: message } as Msg];
    setMessages(next);
    setInput('');
    scrollToBottom();
    try {
      const { reply } = await chat.mutateAsync({ message, history });
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: '⚠️ Could not get a response from the assistant.' },
      ]);
    } finally {
      scrollToBottom();
    }
  };

  if (!opened) return null;

  return (
    <Paper
      shadow="xl"
      radius="md"
      withBorder
      style={{
        position: 'fixed',
        right: 16,
        bottom: 84,
        width: 'min(380px, calc(100vw - 32px))',
        height: 'min(520px, calc(100vh - 140px))',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Group
        justify="space-between"
        px="sm"
        py="xs"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <Group gap="xs">
          <IconSparkles size={18} color="var(--mantine-color-grape-6)" />
          <Text fw={600} size="sm">
            Thoth Assistant
          </Text>
        </Group>
        <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Close assistant">
          <IconX size={18} />
        </ActionIcon>
      </Group>

      <ScrollArea viewportRef={viewport} style={{ flex: 1 }} p="sm">
        <Stack gap="sm">
          {messages.length === 0 && (
            <Text c="dimmed" size="sm" ta="center" py="xl">
              {projectId
                ? 'Ask about this project — findings, scope, and sections — or about CVSS, OWASP, and best practices.'
                : 'Ask about findings, severity/CVSS, OWASP, or security best practices.'}
            </Text>
          )}
          {messages.map((m, i) => (
            <Paper
              key={i}
              p="xs"
              radius="md"
              withBorder
              bg={
                dark
                  ? m.role === 'user'
                    ? 'var(--mantine-color-dark-5)'
                    : 'var(--mantine-color-dark-6)'
                  : m.role === 'user'
                    ? 'var(--mantine-color-gray-0)'
                    : 'var(--mantine-color-grape-0)'
              }
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                borderColor: border,
              }}
            >
              {m.role === 'assistant' ? (
                <div
                  style={{
                    color: dark ? 'var(--mantine-color-white)' : undefined,
                    fontSize: 'var(--mantine-font-size-sm)',
                  }}
                >
                  <MarkdownPreview source={m.content} />
                </div>
              ) : (
                <Text
                  size="sm"
                  style={{
                    whiteSpace: 'pre-wrap',
                    color: dark ? 'var(--mantine-color-white)' : undefined,
                  }}
                >
                  {m.content}
                </Text>
              )}
            </Paper>
          ))}
          {chat.isPending && (
            <Group gap="xs" c="dimmed">
              <Loader size="xs" />
              <Text size="sm">Thinking…</Text>
            </Group>
          )}
        </Stack>
      </ScrollArea>

      <Box p="sm" style={{ borderTop: `1px solid ${border}` }}>
        <Group align="flex-end" gap="xs" wrap="nowrap">
          <Textarea
            placeholder="Type your question…"
            autosize
            minRows={1}
            maxRows={4}
            style={{ flex: 1 }}
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <ActionIcon
            size="lg"
            color="brandGreen"
            variant="filled"
            disabled={!input.trim() || chat.isPending}
            onClick={() => void send()}
            aria-label="Send"
          >
            <IconSend size={18} />
          </ActionIcon>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          Enter sends · Shift+Enter adds a line break
        </Text>
      </Box>
    </Paper>
  );
}
