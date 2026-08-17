import { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { useComputedColorScheme } from '@mantine/core';
import { SegmentedControl, Box, Paper } from '@mantine/core';
import { MarkdownPreview } from './MarkdownPreview';

interface Props {
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
  /** projectId enables attachment resolution in the preview. */
  projectId?: string;
}

/**
 * Markdown editor with CodeMirror 6 and preview via react-markdown.
 * Edit / Split / Preview tabs.
 */
export function MarkdownEditor({ value, onChange, minHeight = 220, projectId }: Props) {
  const [mode, setMode] = useState<'edit' | 'split' | 'preview'>('split');
  const scheme = useComputedColorScheme('light');

  const editor = (
    <CodeMirror
      value={value}
      height={`${minHeight}px`}
      theme={scheme === 'dark' ? oneDark : 'light'}
      extensions={[markdown()]}
      onChange={onChange}
      basicSetup={{ lineNumbers: false, foldGutter: false }}
    />
  );

  const preview = (
    <Paper withBorder p="sm" style={{ minHeight, overflow: 'auto', maxHeight: minHeight * 2.5 }}>
      <MarkdownPreview source={value} projectId={projectId} />
    </Paper>
  );

  return (
    <Box>
      <SegmentedControl
        size="xs"
        mb="xs"
        value={mode}
        onChange={(v) => setMode(v as typeof mode)}
        data={[
          { label: 'Edit', value: 'edit' },
          { label: 'Split', value: 'split' },
          { label: 'Preview', value: 'preview' },
        ]}
      />
      {mode === 'edit' && <Paper withBorder>{editor}</Paper>}
      {mode === 'preview' && preview}
      {mode === 'split' && (
        <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Paper withBorder>{editor}</Paper>
          {preview}
        </Box>
      )}
    </Box>
  );
}
