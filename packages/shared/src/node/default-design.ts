/**
 * Default report design (placeholder branding — replace it with your company's).
 * Editable in Settings → Designs; colors live in :root in the CSS.
 */

const HTML_TEMPLATE = `
<div class="cover">
  <div class="cover-body">
    <h1 class="cover-title">{{project.name}}</h1>
  </div>
  <div class="cover-fields">
    <div><strong>Date:</strong> {{cover.date}}</div>
    <div><strong>Author:</strong> {{cover.responsible}}</div>
  </div>
</div>

<nav class="toc">
  <h2>Table of Contents</h2>
  {{#each toc}}
  <div class="toc-row toc-l{{level}}">
    <span class="toc-label">{{label}}</span>
    <span class="toc-dots"></span>
    <span class="toc-page" data-target="{{targetId}}"></span>
  </div>
  {{/each}}
</nav>

<section class="engagement" id="sec-engagement">
  <h2>Engagement Details</h2>
  <table class="kv">
    <tr><th>Project</th><td>{{project.name}}</td></tr>
    {{#if project.client}}<tr><th>Client / Business Unit</th><td>{{project.client}}</td></tr>{{/if}}
    <tr><th>Status</th><td>{{project.statusLabel}}</td></tr>
    {{#if project.startDate}}<tr><th>Time Frame</th><td>{{formatDate project.startDate}}{{#if project.endDate}} — {{formatDate project.endDate}}{{/if}}</td></tr>{{/if}}
    {{#if project.scope}}<tr><th>Scope</th><td class="prewrap">{{project.scope}}</td></tr>{{/if}}
  </table>
</section>

<section class="summary" id="sec-summary">
  <h2>Vulnerability Summary</h2>
  <p class="summary-total">{{stats.total}} vulnerability(ies) identified in this engagement.</p>
  <table class="sev-table">
    {{#each stats.counts}}
    <tr>
      <td class="sev-name"><span class="sev-chip" style="background:{{color}}">{{label}}</span></td>
      <td class="sev-count">{{count}}</td>
      <td class="sev-bar-cell"><div class="sev-bar" style="width:{{barWidth}}%;background:{{color}}"></div></td>
    </tr>
    {{/each}}
  </table>

  {{#if findings.length}}
  <table class="findings-index">
    <thead><tr><th>Ref.</th><th>Vulnerability</th><th>Severity</th><th>CVSS</th><th>Status</th></tr></thead>
    <tbody>
      {{#each findings}}
      <tr>
        <td>{{ref}}</td>
        <td>{{title}}</td>
        <td><span class="sev-chip" style="background:{{severityColor}}">{{severityLabel}}</span></td>
        <td>{{#if cvssScoreLabel}}{{cvssScoreLabel}}{{else}}—{{/if}}</td>
        <td>{{statusLabel}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  {{/if}}
</section>

{{#each sectionsBefore}}
<section class="report-section" id="{{anchorId}}">
  <h2>{{title}}</h2>
  <div class="md">{{{html}}}</div>
</section>
{{/each}}

{{#if findings.length}}
<section class="findings" id="sec-findings">
  <h2>Finding Details</h2>
  {{#each findings}}
  <article class="finding" id="finding-{{ref}}">
    <div class="finding-head" style="border-left-color:{{severityColor}}">
      <div class="finding-ref">{{ref}}</div>
      <h3 class="finding-title">{{title}}</h3>
      <span class="sev-chip" style="background:{{severityColor}}">{{severityLabel}}{{#if cvssScoreLabel}} · {{cvssScoreLabel}}{{/if}}</span>
    </div>
    <table class="kv finding-meta">
      {{#if cvssVector}}<tr><th>CVSS Vector</th><td><code>{{cvssVector}}</code></td></tr>{{/if}}
      <tr><th>Status</th><td>{{statusLabel}}</td></tr>
      {{#if affectedAssets.length}}
      <tr><th>Affected assets</th><td>{{#each affectedAssets}}<div>{{this}}</div>{{/each}}</td></tr>
      {{/if}}
    </table>
    {{#if descriptionHtml}}<h4>Description</h4><div class="md">{{{descriptionHtml}}}</div>{{/if}}
    {{#if impactHtml}}<h4>Impact</h4><div class="md">{{{impactHtml}}}</div>{{/if}}
    {{#if recommendationHtml}}<h4>Remediation</h4><div class="md">{{{recommendationHtml}}}</div>{{/if}}
    {{#if referencesHtml}}<h4>References</h4><div class="md">{{{referencesHtml}}}</div>{{/if}}
  </article>
  {{/each}}
</section>
{{/if}}

{{#each sectionsAfter}}
<section class="report-section" id="{{anchorId}}">
  <h2>{{title}}</h2>
  <div class="md">{{{html}}}</div>
</section>
{{/each}}
`;

const CSS = `
:root {
  --brand: #0da65c;
  --brand-dark: #087a43;
  --ink: #1a2b23;
  --muted: #5a6b62;
  --line: #dde5e0;
  --bg-soft: #f2f7f4;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  color: var(--ink);
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
}

h1, h2, h3, h4 { color: var(--ink); line-height: 1.25; }
h2 {
  font-size: 16pt;
  border-bottom: 2px solid var(--brand);
  padding-bottom: 4px;
  margin: 0 0 14px;
}
h4 { margin: 14px 0 4px; font-size: 11pt; color: var(--brand-dark); }

section, article { page-break-inside: auto; }
.report-section, .summary, .engagement, .findings, .toc { page-break-before: always; }

/* ---------- Table of Contents ---------- */
.toc-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 3px 0;
  font-size: 10pt;
}
.toc-l2 { padding-left: 8mm; font-size: 9pt; color: var(--muted); }
.toc-label { flex: 0 1 auto; }
.toc-dots {
  flex: 1 1 auto;
  border-bottom: 1px dotted var(--line);
  transform: translateY(-3px);
  min-width: 8mm;
}
.toc-page { flex: 0 0 auto; font-variant-numeric: tabular-nums; color: var(--muted); }

/* ---------- Cover ---------- */
.cover {
  height: 239mm; /* A4 minus the PDF margins (header/footer repeat on every page) */
  display: flex;
  flex-direction: column;
}
.cover-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
.cover-title { font-size: 26pt; margin: 0; max-width: 160mm; }
.cover-fields { font-size: 11pt; line-height: 1.9; padding-bottom: 6mm; }
.cover-fields strong { color: var(--ink); }

/* ---------- Tables ---------- */
table { border-collapse: collapse; width: 100%; }
table.kv th {
  text-align: left;
  width: 34mm;
  color: var(--muted);
  font-weight: 600;
  vertical-align: top;
  padding: 4px 8px 4px 0;
}
table.kv td { padding: 4px 0; }
table.kv tr { border-bottom: 1px solid var(--line); }
.prewrap { white-space: pre-wrap; }

.sev-table { margin: 8px 0 16px; }
.sev-table td { padding: 3px 6px 3px 0; }
.sev-name { width: 34mm; }
.sev-count { width: 10mm; text-align: right; font-weight: 700; }
.sev-bar-cell { }
.sev-bar { height: 9px; border-radius: 4px; min-width: 2px; }

.sev-chip {
  display: inline-block;
  color: #fff;
  border-radius: 4px;
  padding: 1px 8px;
  font-size: 8.5pt;
  font-weight: 700;
  white-space: nowrap;
}

.findings-index th, .findings-index td {
  border: 1px solid var(--line);
  padding: 5px 8px;
  text-align: left;
  font-size: 9.5pt;
}
.findings-index thead th { background: var(--bg-soft); }

/* ---------- Findings ---------- */
.finding { margin-bottom: 12mm; page-break-inside: avoid; }
.finding-head {
  border-left: 6px solid;
  background: var(--bg-soft);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.finding-ref { font-weight: 700; color: var(--muted); }
.finding-title { flex: 1; margin: 0; font-size: 13pt; }
.finding-meta { margin: 8px 0; }

/* ---------- Markdown ---------- */
.md p { margin: 6px 0; }
.md pre {
  background: #10231b;
  color: #d9f2e4;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 8.5pt;
  white-space: pre-wrap;
  word-break: break-word;
}
.md code { font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 9pt; }
.md p code, .md li code, .md td code {
  background: var(--bg-soft);
  padding: 1px 4px;
  border-radius: 3px;
}
.md img { max-width: 100%; border: 1px solid var(--line); border-radius: 4px; }
.md table th, .md table td { border: 1px solid var(--line); padding: 4px 8px; }
.md blockquote {
  border-left: 3px solid var(--brand);
  margin: 8px 0;
  padding: 2px 12px;
  color: var(--muted);
}
.md a { color: var(--brand-dark); }
`;

// Header repeated on EVERY page: colored band with a placeholder logo/name — replace
// it with your company's branding in Settings → Designs.
// Header/footer backgrounds do not print reliably in Chromium, so the band is an
// inline SVG (the <rect> `fill` always renders). The `slice` makes the SVG fill
// the full width while keeping the aspect ratio.
// Chromium rendering details:
// - FIXED height (px), width-bound (<= 0.79*viewBoxH) so the logo on the left is not cut off.
// - viewBox with "bleed" at the top (logo/arc at the bottom) + negative margin-top:
//   the band bleeds up to the top edge without clipping the logo.
const HEADER_TEMPLATE = `<div style="width:100%;margin:-6mm 0 0 0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
<svg width="100%" height="120" viewBox="0 0 1000 160" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="1000" height="160" fill="#0da65c"/>
  <path d="M765 172 A182 182 0 0 1 1000 8 A122 122 0 0 0 782 172 Z" fill="#ffffff"/>
  <rect x="46" y="54" width="60" height="60" rx="18" fill="none" stroke="#ffffff" stroke-width="4"/>
  <path d="M64 96 L76 72 L88 96 M70 88 L82 88" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="124" y="98" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#ffffff">Your Company</text>
  <text x="126" y="128" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="400" fill="#ffffff">Penetration Test Report</text>
</svg>
</div>`;

// Footer repeated on EVERY page: confidentiality notice, subtitle (document title,
// built from the project) and page number.
const FOOTER_TEMPLATE = `<div style="width:100%;margin:0;font-family:Arial,Helvetica,sans-serif;position:relative;">
  <div style="text-align:center;font-size:9px;font-weight:700;color:#1a2b23;">Confidential – Restricted Use</div>
  <div style="text-align:center;font-size:8px;color:#5a6b62;margin-top:1px;"><span class="title"></span></div>
  <div style="position:absolute;right:14mm;top:0;font-size:9px;color:#5a6b62;"><span class="pageNumber"></span></div>
</div>`;

export const DEFAULT_DESIGN = {
  name: 'THOTH — Default',
  description:
    "THOTH's default design (placeholder branding — customize it with your company's brand): top band and confidentiality footer on every page, cover, severity summary, sections, and findings.",
  htmlTemplate: HTML_TEMPLATE.trim(),
  css: CSS.trim(),
  headerTemplate: HEADER_TEMPLATE,
  footerTemplate: FOOTER_TEMPLATE,
};
