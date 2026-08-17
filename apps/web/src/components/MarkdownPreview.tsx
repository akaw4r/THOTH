import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ATTACHMENT_URI_PREFIX } from '@thoth/shared';

interface Props {
  source: string;
  projectId?: string;
}

/**
 * Markdown preview. `attachment:<id>` references are resolved to the authenticated
 * API route when a projectId is present. react-markdown does not interpret raw
 * HTML (no rehype-raw), so it is safe by default.
 */
export function MarkdownPreview({ source, projectId }: Props) {
  const resolved =
    projectId && source
      ? source.replace(
          new RegExp(`${ATTACHMENT_URI_PREFIX}([0-9a-fA-F-]{36})`, 'g'),
          (_all, id: string) => `/api/projects/${projectId}/attachments/${id}/raw`,
        )
      : source;

  return (
    <div className="thoth-md-preview">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {resolved}
      </Markdown>
    </div>
  );
}
