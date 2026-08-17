import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequireProjectRole } from '../auth/decorators';
import { ProjectRoleGuard } from '../auth/project-role.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AiService, type ChatMessage } from './ai.service';

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      }),
    )
    .max(20)
    .optional(),
});
type ChatInput = z.infer<typeof chatSchema>;

const findingFieldSchema = z.object({
  field: z.enum(['description', 'impact', 'references']),
});
type FindingFieldInput = z.infer<typeof findingFieldSchema>;

/** AI assistant — general queries about the application. */
@Controller('ai')
@UseGuards(RolesGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status() {
    return { enabled: this.ai.enabled };
  }

  @Post('chat')
  async chat(@Body(new ZodValidationPipe(chatSchema)) body: ChatInput) {
    const reply = await this.ai.generalChat(body.message, (body.history ?? []) as ChatMessage[]);
    return { reply };
  }
}

/** AI actions scoped to a project (require an editing role). */
@Controller('projects/:projectId/ai')
@UseGuards(RolesGuard, ProjectRoleGuard)
export class ProjectAiController {
  constructor(private readonly ai: AiService) {}

  @Post('executive-summary')
  @RequireProjectRole('EDITOR')
  async executiveSummary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const summary = await this.ai.executiveSummary(projectId);
    return { summary };
  }

  /** Generates the body of the Conclusion section (plain text, no titles). */
  @Post('conclusion')
  @RequireProjectRole('EDITOR')
  async conclusion(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const text = await this.ai.conclusion(projectId);
    return { text };
  }

  /** Generates a finding field (description, impact or references) — plain text. */
  @Post('findings/:findingId/field')
  @RequireProjectRole('EDITOR')
  async findingField(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Body(new ZodValidationPipe(findingFieldSchema)) body: FindingFieldInput,
  ) {
    const text = await this.ai.findingField(projectId, findingId, body.field);
    return { text };
  }

  /** Thoth Assistant chat with the project context (read access is enough). */
  @Post('chat')
  @RequireProjectRole('VIEWER')
  async chat(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(chatSchema)) body: ChatInput,
  ) {
    const reply = await this.ai.projectChat(
      projectId,
      body.message,
      (body.history ?? []) as ChatMessage[],
    );
    return { reply };
  }
}
