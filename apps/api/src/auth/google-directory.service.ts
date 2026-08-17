import { Injectable, Logger } from '@nestjs/common';
import { JWT } from 'google-auth-library';
import { ConfigService } from '../config/config.service';

const DIRECTORY_SCOPE = 'https://www.googleapis.com/auth/admin.directory.group.member.readonly';

/**
 * Checks Google Workspace group membership via the Directory API (Admin SDK),
 * using a service account with domain-wide delegation. Google's OIDC token does
 * not carry groups, so this check is done outside the OIDC flow.
 *
 * Fail-closed: any error (misconfigured SA, unavailable API, nonexistent
 * member) results in "not a member" — access is denied, never granted by
 * mistake. The local admin (break-glass) remains the recovery path.
 */
@Injectable()
export class GoogleDirectoryService {
  private readonly logger = new Logger(GoogleDirectoryService.name);
  private client: JWT | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): JWT | null {
    if (this.client) return this.client;
    const sa = this.config.googleWorkspaceSa;
    const subject = this.config.googleWorkspaceAdminSubject;
    if (!sa || !subject) return null;
    this.client = new JWT({
      email: sa.clientEmail,
      key: sa.privateKey,
      scopes: [DIRECTORY_SCOPE],
      subject, // impersonates a Workspace admin (domain-wide delegation)
    });
    return this.client;
  }

  /**
   * True if the email is a member of AT LEAST ONE of the allowed groups.
   * Returns false (denies) on any error.
   */
  async isMemberOfAllowedGroup(email: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      this.logger.error('Directory API not configured (missing service account).');
      return false;
    }
    const member = encodeURIComponent(email.toLowerCase().trim());
    for (const group of this.config.allowedGoogleGroups) {
      const url = `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(
        group,
      )}/hasMember/${member}`;
      try {
        const res = await client.request<{ isMember?: boolean }>({ url });
        if (res.data?.isMember === true) return true;
      } catch (err) {
        // 404 = the email is not a member (or does not exist in the directory) — keep
        // trying the other groups; other errors are logged and treated as "not a member".
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status !== 404) {
          this.logger.warn(
            `Failed to check group ${group} for ${email}: ${(err as Error).message}`,
          );
        }
      }
    }
    return false;
  }
}
