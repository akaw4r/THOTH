import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownPreview } from './MarkdownPreview';

describe('MarkdownPreview', () => {
  it('renders markdown as HTML', () => {
    render(<MarkdownPreview source={'# Hello\n\nworld **strong**'} />);
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByText('strong')).toBeInTheDocument();
  });

  it('does not execute embedded raw HTML (no rehype-raw)', () => {
    const { container } = render(<MarkdownPreview source={'<script>alert(1)</script> text'} />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('resolves attachment: references to the API route', () => {
    const id = '11111111-2222-3333-4444-555555555555';
    const { container } = render(
      <MarkdownPreview source={`![ev](attachment:${id})`} projectId="proj-1" />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe(`/api/projects/proj-1/attachments/${id}/raw`);
  });
});
