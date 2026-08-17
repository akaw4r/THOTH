import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuditLogDto,
  DashboardMetrics,
  DesignDto,
  FindingDto,
  FindingTemplateDto,
  OwaspCategoryDto,
  Paginated,
  ProjectDto,
  ReportDto,
  SectionDto,
  UserDto,
} from '@thoth/shared';
import { api } from './client';

// ---- Projects -------------------------------------------------------------

export const useProjects = () =>
  useQuery({ queryKey: ['projects'], queryFn: () => api.get<ProjectDto[]>('/projects') });

export const useProject = (id: string) =>
  useQuery({ queryKey: ['project', id], queryFn: () => api.get<ProjectDto>(`/projects/${id}`) });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ProjectDto>) => api.post<ProjectDto>('/projects', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
};

export const useUpdateProject = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ProjectDto>) => api.put<ProjectDto>(`/projects/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
};

export const useUpsertMember = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    // userId (existing user) OR email (pre-authorizes someone who has not signed in yet).
    mutationFn: (body: { userId?: string; email?: string; role: string }) =>
      api.post(`/projects/${projectId}/members`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });
};

// Bulk access grant by email (admin) — one role, multiple projects.
export const useGrantAccess = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: string; projectIds: string[] }) =>
      api.post<{ userId: string; email: string; role: string; projectCount: number }>(
        '/access/grants',
        body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
};

export const useRemoveMember = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.del(`/projects/${projectId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });
};

// ---- Findings -------------------------------------------------------------

export const useFindings = (projectId: string) =>
  useQuery({
    queryKey: ['findings', projectId],
    queryFn: () => api.get<FindingDto[]>(`/projects/${projectId}/findings`),
  });

export const useFinding = (projectId: string, id: string) =>
  useQuery({
    queryKey: ['finding', projectId, id],
    queryFn: () => api.get<FindingDto>(`/projects/${projectId}/findings/${id}`),
    enabled: Boolean(id),
  });

export const useCreateFinding = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<FindingDto>) =>
      api.post<FindingDto>(`/projects/${projectId}/findings`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['findings', projectId] }),
  });
};

export const useCreateFindingFromTemplate = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      api.post<FindingDto>(`/projects/${projectId}/findings/from-template`, { templateId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['findings', projectId] }),
  });
};

export const useUpdateFinding = (projectId: string, id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<FindingDto>) =>
      api.put<FindingDto>(`/projects/${projectId}/findings/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['findings', projectId] });
      qc.invalidateQueries({ queryKey: ['finding', projectId, id] });
    },
  });
};

export const useDeleteFinding = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/projects/${projectId}/findings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['findings', projectId] }),
  });
};

// ---- Sections -------------------------------------------------------------

export const useSections = (projectId: string) =>
  useQuery({
    queryKey: ['sections', projectId],
    queryFn: () => api.get<SectionDto[]>(`/projects/${projectId}/sections`),
  });

export const useCreateSection = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; contentMd?: string }) =>
      api.post<SectionDto>(`/projects/${projectId}/sections`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections', projectId] }),
  });
};

export const useUpdateSection = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; contentMd?: string }) =>
      api.put<SectionDto>(`/projects/${projectId}/sections/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections', projectId] }),
  });
};

export const useDeleteSection = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/projects/${projectId}/sections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections', projectId] }),
  });
};

// ---- Templates ------------------------------------------------------------

export const useTemplates = () =>
  useQuery({ queryKey: ['templates'], queryFn: () => api.get<FindingTemplateDto[]>('/templates') });

// OWASP catalog (rarely changes) — long cache to feed the selects.
export const useOwaspCategories = () =>
  useQuery({
    queryKey: ['owasp-categories'],
    queryFn: () => api.get<OwaspCategoryDto[]>('/owasp-categories'),
    staleTime: 60 * 60 * 1000,
  });

export const useCreateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<FindingTemplateDto>) =>
      api.post<FindingTemplateDto>('/templates', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
};

export const useUpdateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<FindingTemplateDto> & { id: string }) =>
      api.put<FindingTemplateDto>(`/templates/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
};

export const useDeleteTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
};

// ---- Reports & Designs ----------------------------------------------------

export const useReports = (projectId: string) =>
  useQuery({
    queryKey: ['reports', projectId],
    queryFn: () => api.get<ReportDto[]>(`/projects/${projectId}/reports`),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((r) => r.status === 'QUEUED' || r.status === 'RENDERING')
        ? 2500
        : false,
  });

export const useRequestReport = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (designId?: string | null) =>
      api.post<ReportDto>(`/projects/${projectId}/reports`, { designId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', projectId] }),
  });
};

export const useDeleteReport = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/projects/${projectId}/reports/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', projectId] }),
  });
};

export const useDesigns = () =>
  useQuery({ queryKey: ['designs'], queryFn: () => api.get<DesignDto[]>('/designs') });

export const useCreateDesign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<DesignDto>) => api.post<DesignDto>('/designs', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['designs'] }),
  });
};

export const useUpdateDesign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<DesignDto> & { id: string }) =>
      api.put<DesignDto>(`/designs/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['designs'] }),
  });
};

// ---- Users & Audit --------------------------------------------------------

export const useUsers = () =>
  useQuery({ queryKey: ['users'], queryFn: () => api.get<UserDto[]>('/users') });

// Adds/promotes a user by email with a global role (including ADMIN) — admin only.
export const useUpsertUserByEmail = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: string }) => api.post<UserDto>('/users', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useUpdateUserRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.put<UserDto>(`/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useAudit = (params: { page: number; action?: string; actorEmail?: string }) =>
  useQuery({
    queryKey: ['audit', params],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(params.page) });
      if (params.action) qs.set('action', params.action);
      if (params.actorEmail) qs.set('actorEmail', params.actorEmail);
      return api.get<Paginated<AuditLogDto>>(`/audit?${qs.toString()}`);
    },
  });

// ---- Dashboard -------------------------------------------------------------
export interface DashboardFilters {
  projectIds: string[];
  severities: string[];
  from: string;
  to: string;
}

export const useDashboard = (filters: DashboardFilters) =>
  useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filters.projectIds.length) qs.set('projectIds', filters.projectIds.join(','));
      if (filters.severities.length) qs.set('severities', filters.severities.join(','));
      if (filters.from) qs.set('from', filters.from);
      if (filters.to) qs.set('to', filters.to);
      const suffix = qs.toString() ? `?${qs}` : '';
      return api.get<DashboardMetrics>(`/dashboard/metrics${suffix}`);
    },
  });

// ---- AI (assistant) ---------------------------------------------------------
export const useAiStatus = () =>
  useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.get<{ enabled: boolean }>('/ai/status'),
    staleTime: 5 * 60 * 1000,
  });

// With a projectId, Thoth Assistant answers WITH the project context (findings +
// sections); without it, it is the application-wide chat.
export const useAiChat = (projectId?: string) =>
  useMutation({
    mutationFn: (body: {
      message: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
    }) =>
      api.post<{ reply: string }>(projectId ? `/projects/${projectId}/ai/chat` : '/ai/chat', body),
  });

export const useGenerateExecutiveSummary = (projectId: string) =>
  useMutation({
    mutationFn: () => api.post<{ summary: string }>(`/projects/${projectId}/ai/executive-summary`),
  });

// Generates the Conclusion section body (plain text, no headings) — replaces the draft.
export const useGenerateConclusion = (projectId: string) =>
  useMutation({
    mutationFn: () => api.post<{ text: string }>(`/projects/${projectId}/ai/conclusion`),
  });

// Generates a finding field (description, impact, or references) — replaces the draft.
export type FindingAiField = 'description' | 'impact' | 'references';
export const useGenerateFindingField = (projectId: string, findingId: string) =>
  useMutation({
    mutationFn: (field: FindingAiField) =>
      api.post<{ text: string }>(`/projects/${projectId}/ai/findings/${findingId}/field`, {
        field,
      }),
  });
