import { render } from '@react-email/render';
import InvitationEmail from './emails/invitation';
import { normalizeLocale, type EmailLocale } from './emails/i18n';
import NotificationEmail from './emails/notification';
import { renderOTPTemplate } from './emails/otp-template';

type RenderNotificationPayload = {
  title: string;
  message: string;
  locale?: EmailLocale;
};

type RenderOTPPayload = {
  code: string;
  purpose: string;
  expiresIn?: string;
  locale?: EmailLocale;
};

type InvitationTemplatePayload = {
  organizationName: string;
  inviterName?: string;
  role?: string;
  projectName?: string;
  projectId?: string;
  customMessage?: string;
  acceptUrl?: string;
  expiresAt?: string;
  locale?: EmailLocale;
};

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseJSON<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseInvitationTemplate(title: string, message: string): InvitationTemplatePayload | null {
  const cleanTitle = title.trim();
  const cleanMessage = message.trim();
  if (
    !cleanTitle.toLowerCase().startsWith('invitation a rejoindre ') &&
    !cleanMessage.includes("Accepter l'invitation:")
  ) {
    return null;
  }

  const lines = cleanMessage
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim());

  let organizationName = cleanTitle.replace(/^Invitation a rejoindre\s+/i, '').trim();
  let role = '';
  let projectName = '';
  let acceptUrl = '';
  let expiresAt = '';
  const customMessageLines: string[] = [];

  for (const [index, line] of lines.entries()) {
    if (!line) {
      continue;
    }
    const orgMatch = line.match(/^Vous avez ete invite a rejoindre (.+)\.$/i);
    if (index === 0 && orgMatch) {
      organizationName = orgMatch[1].trim();
      continue;
    }
    const roleMatch = line.match(/^Role:\s*(.+)\.$/i);
    if (roleMatch) {
      role = roleMatch[1].trim();
      continue;
    }
    const projectMatch = line.match(/^Cette invitation est limitee au projet (.+)\.$/i);
    if (projectMatch) {
      projectName = projectMatch[1].trim();
      continue;
    }
    const urlMatch = line.match(/^Accepter l'invitation:\s*(.+)$/i);
    if (urlMatch) {
      acceptUrl = urlMatch[1].trim();
      continue;
    }
    const expiresMatch = line.match(/^Expire le:\s*(.+)\.$/i);
    if (expiresMatch) {
      expiresAt = expiresMatch[1].trim();
      continue;
    }
    customMessageLines.push(line);
  }

  if (!organizationName && !acceptUrl) {
    return null;
  }

  return {
    organizationName,
    role,
    projectName,
    customMessage: customMessageLines.join('\n').trim(),
    acceptUrl,
    expiresAt,
    locale: 'fr',
  };
}

const portRaw = process.env.EMAIL_API_PORT;
if (!portRaw) {
  throw new Error('missing required environment variable EMAIL_API_PORT');
}
const port = Number.parseInt(portRaw, 10);
if (!Number.isFinite(port) || port <= 0) {
  throw new Error('invalid EMAIL_API_PORT');
}

Bun.serve({
  port,
  fetch: async (req) => {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/health') {
      return jsonResponse(200, { status: 'ok', service: 'email-renderer' });
    }

    if (req.method === 'POST' && url.pathname === '/render/notification') {
      const raw = await req.text();
      const parsed = parseJSON<RenderNotificationPayload>(raw);
      if (!parsed || !parsed.title?.trim() || !parsed.message?.trim()) {
        return jsonResponse(400, { error: 'invalid payload' });
      }

      const subject = parsed.title.trim();
      const message = parsed.message.trim();
      const locale = normalizeLocale(parsed.locale);
      const invitation = parseInvitationTemplate(subject, message);
      const html = invitation
        ? await render(InvitationEmail({ ...invitation, locale }))
        : await render(NotificationEmail({ title: subject, message, locale }));
      return jsonResponse(200, { subject, html, text: message });
    }

    if (req.method === 'POST' && url.pathname === '/render/invitation') {
      const raw = await req.text();
      const parsed = parseJSON<InvitationTemplatePayload>(raw);
      if (!parsed || !parsed.organizationName?.trim()) {
        return jsonResponse(400, { error: 'invalid payload' });
      }

      const locale = normalizeLocale(parsed.locale);
      const invitation = {
        ...parsed,
        organizationName: parsed.organizationName.trim(),
        inviterName: parsed.inviterName?.trim(),
        role: parsed.role?.trim(),
        projectName: parsed.projectName?.trim() || parsed.projectId?.trim(),
        projectId: parsed.projectId?.trim(),
        customMessage: parsed.customMessage?.trim(),
        acceptUrl: parsed.acceptUrl?.trim(),
        expiresAt: parsed.expiresAt?.trim(),
        locale,
      } satisfies InvitationTemplatePayload;

      const html = await render(InvitationEmail(invitation));
      const subject =
        locale === 'en'
          ? `Invitation to join ${invitation.organizationName}`
          : `Invitation à rejoindre ${invitation.organizationName}`;
      const lines = [
        locale === 'en'
          ? `You have been invited to join ${invitation.organizationName}.`
          : `Vous avez été invité à rejoindre ${invitation.organizationName}.`,
      ];

      if (invitation.role) {
        lines.push(locale === 'en' ? `Role: ${invitation.role}.` : `Rôle: ${invitation.role}.`);
      }
      if (invitation.projectName) {
        lines.push(
          locale === 'en'
            ? `This invitation is limited to project ${invitation.projectName}.`
            : `Cette invitation est limitée au projet ${invitation.projectName}.`,
        );
      }
      if (invitation.customMessage) {
        lines.push('', invitation.customMessage);
      }
      if (invitation.acceptUrl) {
        lines.push(
          '',
          locale === 'en'
            ? `Accept invitation: ${invitation.acceptUrl}`
            : `Accepter l'invitation: ${invitation.acceptUrl}`,
        );
      }
      if (invitation.expiresAt) {
        lines.push(
          locale === 'en'
            ? `Expires on: ${invitation.expiresAt}.`
            : `Expire le : ${invitation.expiresAt}.`,
        );
      }

      return jsonResponse(200, { subject, html, text: lines.join('\n') });
    }

    if (req.method === 'POST' && url.pathname === '/render/otp') {
      const raw = await req.text();
      const parsed = parseJSON<RenderOTPPayload>(raw);
      if (!parsed || !parsed.code?.trim() || !parsed.purpose?.trim()) {
        return jsonResponse(400, { error: 'invalid payload' });
      }

      const code = parsed.code.trim();
      const purpose = parsed.purpose.trim();
      const locale = normalizeLocale(parsed.locale);
      const { subject, html, text } = await renderOTPTemplate({
        code,
        purpose,
        expiresIn: parsed.expiresIn,
        locale,
      });
      return jsonResponse(200, { subject, html, text });
    }

    return jsonResponse(404, { error: 'not found' });
  },
});
