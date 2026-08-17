import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { ATTACHMENT_URI_PREFIX } from '../constants';

const md = new MarkdownIt({
  html: false, // raw HTML in markdown is ignored
  linkify: true,
  breaks: false,
});

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'strong',
    'em',
    's',
    'del',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'a',
    'img',
    'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel'],
    img: ['src', 'alt', 'title'],
    code: ['class'],
    span: ['class'],
    th: ['align'],
    td: ['align'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    // data: is required for images embedded in the PDF; /api/attachments in the web preview
    img: ['data', 'https', 'http'],
  },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

const ATTACHMENT_RE = new RegExp(`${ATTACHMENT_URI_PREFIX}([0-9a-fA-F-]{36})`, 'g');

export type AttachmentResolver = (attachmentId: string) => string;

/**
 * Converts (untrusted) markdown into sanitized HTML.
 * `attachment:<uuid>` references are resolved via callback
 * (data URI in the worker; API URL in the preview).
 */
export function renderMarkdown(source: string, resolveAttachment?: AttachmentResolver): string {
  const withAttachments = resolveAttachment
    ? source.replace(ATTACHMENT_RE, (_all, id: string) => resolveAttachment(id))
    : source;
  const rendered = md.render(withAttachments ?? '');
  return sanitizeHtml(rendered, SANITIZE_OPTIONS);
}
