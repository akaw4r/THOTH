import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SEVERITY_LABELS } from '@thoth/shared';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Finding fields the AI can fill in individually. */
export type FindingAiField = 'description' | 'impact' | 'references';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get enabled(): boolean {
    return this.config.aiEnabled;
  }

  /**
   * Chat call on the configured LLM provider (AI_PROVIDER):
   * 'anthropic' uses the official SDK; 'ollama' uses the local native API.
   */
  private async complete(
    messages: ChatMessage[],
    opts: { maxTokens?: number; temperature?: number } = {},
  ): Promise<string> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'AI assistant is disabled (set AI_PROVIDER, AI_MODEL and the provider credentials).',
      );
    }
    const ai = this.config.ai;
    if (ai.provider === 'anthropic') return this.completeAnthropic(messages, opts);
    return this.completeOllama(messages, opts);
  }

  private async completeAnthropic(
    messages: ChatMessage[],
    opts: { maxTokens?: number },
  ): Promise<string> {
    const { model, apiKey } = this.config.ai;
    const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 2 });
    // The Messages API takes the system prompt in a dedicated field; the other
    // turns go in `messages`. Sampling parameters (temperature) are not sent —
    // current Anthropic models reject them.
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const turns = messages
      .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    try {
      const response = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 1200,
        ...(system ? { system } : {}),
        messages: turns,
      });
      if (response.stop_reason === 'refusal') {
        throw new BadGatewayException(
          'The AI provider refused the request due to safety policy. Rephrase the request.',
        );
      }
      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
      if (!content) throw new BadGatewayException('The AI provider returned an empty response.');
      return content;
    } catch (err) {
      if (err instanceof BadGatewayException) throw err;
      // APIConnectionError is a subclass of APIError in the TS SDK — check it first.
      if (err instanceof Anthropic.APIConnectionError) {
        this.logger.error(`Connection failure to the AI API: ${err.message}`);
        throw new BadGatewayException('Failed to connect to the AI provider. Check the network.');
      }
      // Typed SDK errors: log the detail on the server and return only the
      // status/category to the client — without echoing the raw body or leaking the API key.
      if (err instanceof Anthropic.APIError) {
        this.logger.error(
          `Anthropic responded ${err.status}: ${String(err.message).slice(0, 500)}`,
        );
        if (err instanceof Anthropic.AuthenticationError) {
          throw new BadGatewayException('Invalid AI provider credential (ANTHROPIC_API_KEY).');
        }
        if (err instanceof Anthropic.NotFoundError) {
          throw new BadGatewayException(
            `AI model not found at the provider: ${this.config.ai.model}.`,
          );
        }
        if (err instanceof Anthropic.RateLimitError) {
          throw new BadGatewayException(
            'The AI provider rate-limited the requests. Try again shortly.',
          );
        }
        throw new BadGatewayException(
          `The AI provider rejected the request (HTTP ${err.status ?? '?'}).`,
        );
      }
      throw this.toGatewayError(err, 'api.anthropic.com');
    }
  }

  private async completeOllama(
    messages: ChatMessage[],
    opts: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const { model, ollamaBaseUrl } = this.config.ai;
    const controller = new AbortController();
    // Local models can be slow on modest hardware — generous timeout.
    const timeout = setTimeout(() => controller.abort(), 180_000);
    try {
      const res = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            num_predict: opts.maxTokens ?? 1200,
            temperature: opts.temperature ?? 0.3,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.error(
          `Ollama responded ${res.status} for ${ollamaBaseUrl}: ${detail.slice(0, 500)}`,
        );
        throw new BadGatewayException(
          `Ollama rejected the request (HTTP ${res.status}). ` +
            `Check that the model '${model}' is available (ollama pull ${model}).`,
        );
      }

      const data = (await res.json()) as { message?: { content?: string } };
      const content = data.message?.content?.trim();
      if (!content) throw new BadGatewayException('Ollama returned an empty response.');
      return content;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadGatewayException('Timed out while querying the AI assistant.');
      }
      if (err instanceof BadGatewayException) throw err;
      throw this.toGatewayError(err, ollamaBaseUrl);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Network failures from fetch/undici (DNS, connection refused, TLS) arrive as
   * `TypeError: fetch failed`, with the real reason in `err.cause`. Logs the cause
   * (codes like ENOTFOUND/ECONNREFUSED) and exposes it in an actionable way — without
   * leaking credentials (only the endpoint, which is not a secret).
   */
  private toGatewayError(err: unknown, endpoint: string): BadGatewayException {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    const reason =
      cause instanceof Error && typeof (cause as { code?: unknown }).code === 'string'
        ? String((cause as { code?: unknown }).code)
        : cause instanceof Error
          ? cause.message
          : String(cause);
    this.logger.error(
      `Failed to call the AI provider (${endpoint}): ${reason}`,
      cause instanceof Error ? cause.stack : undefined,
    );
    return new BadGatewayException(`Failed to connect to the AI provider: ${reason}`);
  }

  /** General chat about the application (user queries). */
  async generalChat(message: string, history: ChatMessage[] = []): Promise<string> {
    const system: ChatMessage = {
      role: 'system',
      content:
        'You are Thoth Assistant, the assistant of THOTH — the pentest reporting ' +
        'platform of the offensive security team. Always refer to yourself as ' +
        'Thoth Assistant (never as "the THOTH assistant"). Help with questions about findings, ' +
        'reports, severity/CVSS, OWASP taxonomy (Web/API/LLM) and security best ' +
        "practices. Respond in the same language as the user's message, concisely. Do not " +
        'make up project data that was not provided.',
    };
    const trimmedHistory = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10);
    return this.complete([system, ...trimmedHistory, { role: 'user', content: message }], {
      maxTokens: 1000,
    });
  }

  /**
   * Loads the project and builds a textual context block (findings ordered by
   * severity and, optionally, the report sections) to feed the model. Throws if
   * the project does not exist.
   */
  private async projectContext(
    projectId: string,
    opts: { withSections: boolean },
  ): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        findings: { include: { owaspCategory: true } },
        sections: { orderBy: { order: 'asc' } },
      },
    });
    if (!project) {
      throw new ServiceUnavailableException('Project not found.');
    }

    const severityRank: Record<string, number> = {
      CRITICAL: 5,
      HIGH: 4,
      MEDIUM: 3,
      LOW: 2,
      INFO: 1,
    };
    const findings = [...project.findings].sort(
      (a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0),
    );

    const findingsText = findings.length
      ? findings
          .map((f, i) => {
            const sev = SEVERITY_LABELS[f.severity] ?? f.severity;
            const cvss = f.cvssScore != null ? ` (CVSS ${f.cvssScore.toFixed(1)})` : '';
            const owasp = f.owaspCategory ? ` [${f.owaspCategory.code}]` : '';
            const desc = (f.descriptionMd || '').replace(/\s+/g, ' ').slice(0, 400);
            const impact = (f.impactMd || '').replace(/\s+/g, ' ').slice(0, 300);
            return (
              `${i + 1}. ${f.title} — ${sev}${cvss}${owasp}\n` +
              (desc ? `   Description: ${desc}\n` : '') +
              (impact ? `   Impact: ${impact}\n` : '')
            );
          })
          .join('\n')
      : '(No findings registered.)';

    const scope = (project.scope || '').replace(/\s+/g, ' ').slice(0, 500);

    const parts = [
      `Project: ${project.name}`,
      `Client/Unit: ${project.client || '—'}`,
      `Status: ${project.status}`,
      `Scope: ${scope || '—'}`,
      `Total findings: ${findings.length}`,
      '',
      `Findings (ordered by severity):\n${findingsText}`,
    ];

    if (opts.withSections) {
      const sectionsText = project.sections.length
        ? project.sections
            .map((s) => {
              const body = (s.contentMd || '').replace(/\s+/g, ' ').slice(0, 600);
              return `- ${s.title}${body ? `: ${body}` : ''}`;
            })
            .join('\n')
        : '(No sections registered.)';
      parts.push('', `Report sections:\n${sectionsText}`);
    }

    return parts.join('\n');
  }

  /**
   * Generates the BODY of the Executive Summary (markdown) from the findings.
   * Fills in only Objective, Overall risk assessment, High-level recommendations
   * and Next steps — without repeating the section title/subtitle. Does not save:
   * the text goes back to the user for review.
   */
  async executiveSummary(projectId: string): Promise<string> {
    const context = await this.projectContext(projectId, { withSections: false });

    const system: ChatMessage = {
      role: 'system',
      content:
        'You are a senior offensive security consultant writing the BODY of the Executive ' +
        'Summary of a pentest report, for an executive (non-technical) ' +
        'audience. Produce EXACTLY four sections, in this order, each with a level-3 ' +
        'markdown subtitle (###):\n' +
        '### Objective\n' +
        '### Overall risk assessment\n' +
        '### High-level recommendations\n' +
        '### Next steps\n' +
        'Rules: do NOT write a "# Executive Summary" title or a subtitle with the ' +
        'project/client name — that is already the section title and must not be duplicated. ' +
        'Start the response directly at "### Objective". Write in the same language as the ' +
        'rest of the report content, objective and concise (1 to 2 paragraphs in Objective ' +
        'and Assessment; short lists in Recommendations and Next steps). Do not make up ' +
        'findings beyond those provided.',
    };
    const user: ChatMessage = {
      role: 'user',
      content: `${context}\n\nWrite the four sections of the Executive Summary body based on this data.`,
    };

    return this.complete([system, user], { maxTokens: 1400, temperature: 0.4 });
  }

  /**
   * Generates the text of ONE finding field (description, impact or references)
   * from the finding's own context. Output is plain text, with no
   * titles/subtitles — it replaces the draft in the editor (not saved: the text
   * goes back to the user for review).
   */
  async findingField(projectId: string, findingId: string, field: FindingAiField): Promise<string> {
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, projectId },
      include: { owaspCategory: true, project: true },
    });
    if (!finding) throw new NotFoundException('Finding not found.');

    const clip = (s: string, n: number) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
    const sev = SEVERITY_LABELS[finding.severity] ?? finding.severity;
    const context = [
      `Project: ${finding.project.name}`,
      `Project scope: ${clip(finding.project.scope, 400) || '—'}`,
      '',
      `Finding: ${finding.title}`,
      `Severity: ${sev}${finding.cvssScore != null ? ` (CVSS ${finding.cvssScore.toFixed(1)})` : ''}`,
      finding.owaspCategory
        ? `OWASP category: ${finding.owaspCategory.code} — ${finding.owaspCategory.name}`
        : 'OWASP category: —',
      `Affected assets: ${finding.affectedAssets.join(', ') || '—'}`,
      `Current description: ${clip(finding.descriptionMd, 800) || '(empty)'}`,
      `Current impact: ${clip(finding.impactMd, 500) || '(empty)'}`,
      `Current recommendation: ${clip(finding.recommendationMd, 500) || '(empty)'}`,
      `Current references: ${clip(finding.referencesMd, 400) || '(empty)'}`,
    ].join('\n');

    const fieldInstruction: Record<FindingAiField, string> = {
      description:
        'Write the technical DESCRIPTION of the vulnerability: what it is, how it manifests ' +
        'and where it was observed (use the affected assets when it makes sense). 1 to 3 paragraphs.',
      impact:
        'Write the IMPACT of the vulnerability if exploited: technical and business ' +
        'consequences (data, users, availability, reputation, compliance). 1 to 2 paragraphs.',
      references:
        'List public REFERENCES relevant to this vulnerability (OWASP, CWE, NIST, official ' +
        'documentation), one per line, in the format "Name — URL". Only real and widely ' +
        'known references; do not make up URLs.',
    };

    const system: ChatMessage = {
      role: 'system',
      content:
        'You are a senior offensive security consultant writing one field of a finding ' +
        'in a pentest report. Write in the same language as the rest of the report content, ' +
        'in a technical and objective manner. FORMAT RULES: produce ONLY the field text — it is ' +
        'FORBIDDEN to use markdown titles or subtitles (#, ##, ###), bold as a label, or to ' +
        'repeat the field name at the beginning. Start directly with the content. Do not make ' +
        'up project data beyond the provided context.',
    };
    const user: ChatMessage = {
      role: 'user',
      content: `${context}\n\n${fieldInstruction[field]}`,
    };

    return this.complete([system, user], { maxTokens: 900, temperature: 0.4 });
  }

  /**
   * Generates the BODY of the report's Conclusion section from the findings and
   * the other sections. Output is plain text, with no titles/subtitles — not
   * saved: the text goes back to the user for review.
   */
  async conclusion(projectId: string): Promise<string> {
    const context = await this.projectContext(projectId, { withSections: true });

    const system: ChatMessage = {
      role: 'system',
      content:
        'You are a senior offensive security consultant writing the BODY of the ' +
        'Conclusion section of a pentest report. Synthesize the overall outcome of the ' +
        'work: observed security posture, main risks found and the importance of ' +
        'addressing the recommendations. Write in the same language as the rest of the ' +
        'report content, 2 to 3 paragraphs, professional tone. FORMAT RULES: produce ONLY ' +
        'running text — it is FORBIDDEN to use markdown titles or subtitles (#, ##, ###), ' +
        'lists or bold as a label; do not write "Conclusion" at the beginning (that is ' +
        'already the section title). Start directly with the first paragraph. Do not make ' +
        'up findings beyond those provided.',
    };
    const user: ChatMessage = {
      role: 'user',
      content: `${context}\n\nWrite the body of the Conclusion section based on this data.`,
    };

    return this.complete([system, user], { maxTokens: 900, temperature: 0.4 });
  }

  /**
   * Thoth Assistant chat WITH the context of a project (findings + sections). Project
   * access authorization is enforced in the controller (ProjectRoleGuard).
   */
  async projectChat(
    projectId: string,
    message: string,
    history: ChatMessage[] = [],
  ): Promise<string> {
    const context = await this.projectContext(projectId, { withSections: true });
    const system: ChatMessage = {
      role: 'system',
      content:
        'You are Thoth Assistant, the assistant of THOTH — the pentest reporting ' +
        'platform of the offensive security team. Always refer to yourself as ' +
        'Thoth Assistant. You DO have access to the project data below (scope, findings, ' +
        'severities, CVSS, OWASP taxonomy and report sections) — use it to answer and ' +
        'never ask the user for information already present in the data. Respond in the ' +
        "same language as the user's message, concisely, without making up data beyond " +
        'the provided context.\n\n' +
        `Current project data:\n${context}`,
    };
    const trimmedHistory = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10);
    return this.complete([system, ...trimmedHistory, { role: 'user', content: message }], {
      maxTokens: 1000,
    });
  }
}
