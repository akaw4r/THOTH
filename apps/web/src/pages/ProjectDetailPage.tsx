import { Anchor, Breadcrumbs, Center, Group, Loader, Stack, Tabs, Title } from '@mantine/core';
import {
  IconBug,
  IconFileText,
  IconReportAnalytics,
  IconUsersGroup,
  IconSettings,
} from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';
import type { ProjectRole } from '@thoth/shared';
import { PROJECT_ROLE_LEVEL } from '@thoth/shared';
import { useProject } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { ProjectStatusBadge } from '../components/common';
import { FindingsTab } from './project/FindingsTab';
import { SectionsTab } from './project/SectionsTab';
import { ReportsTab } from './project/ReportsTab';
import { MembersTab } from './project/MembersTab';
import { SettingsTab } from './project/SettingsTab';

export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const { data: project, isLoading } = useProject(projectId);
  const { user } = useAuth();

  if (isLoading || !project) {
    return (
      <Center h={300}>
        <Loader color="brandGreen" />
      </Center>
    );
  }

  const myRole: ProjectRole | null =
    user?.role === 'ADMIN'
      ? 'MANAGER'
      : (project.members?.find((m) => m.userId === user?.id)?.role ?? null);
  const can = (min: ProjectRole) =>
    myRole !== null && PROJECT_ROLE_LEVEL[myRole] >= PROJECT_ROLE_LEVEL[min];

  return (
    <Stack>
      <Breadcrumbs>
        <Anchor component={Link} to="/projects">
          Projects
        </Anchor>
        <Title order={4} m={0}>
          {project.name}
        </Title>
      </Breadcrumbs>
      <Group>
        <Title order={2}>{project.name}</Title>
        <ProjectStatusBadge status={project.status} />
      </Group>

      <Tabs defaultValue="findings" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="findings" leftSection={<IconBug size={16} />}>
            Findings
          </Tabs.Tab>
          <Tabs.Tab value="sections" leftSection={<IconFileText size={16} />}>
            Sections
          </Tabs.Tab>
          <Tabs.Tab value="reports" leftSection={<IconReportAnalytics size={16} />}>
            Reports
          </Tabs.Tab>
          {can('MANAGER') && (
            <Tabs.Tab value="members" leftSection={<IconUsersGroup size={16} />}>
              Members
            </Tabs.Tab>
          )}
          {can('MANAGER') && (
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              Settings
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="findings" pt="md">
          <FindingsTab projectId={projectId} canEdit={can('EDITOR')} />
        </Tabs.Panel>
        <Tabs.Panel value="sections" pt="md">
          <SectionsTab projectId={projectId} canEdit={can('EDITOR')} />
        </Tabs.Panel>
        <Tabs.Panel value="reports" pt="md">
          <ReportsTab projectId={projectId} canEdit={can('EDITOR')} />
        </Tabs.Panel>
        {can('MANAGER') && (
          <Tabs.Panel value="members" pt="md">
            <MembersTab projectId={projectId} />
          </Tabs.Panel>
        )}
        {can('MANAGER') && (
          <Tabs.Panel value="settings" pt="md">
            <SettingsTab project={project} />
          </Tabs.Panel>
        )}
      </Tabs>
    </Stack>
  );
}
