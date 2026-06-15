import { render } from '@react-email/render';
import InvitationEmail from './emails/invitation';
import NotificationEmail from './emails/notification';
import OTPEmail from './emails/otp';

type RenderNotificationPayload = {
  title: string;
  message: string;
};

type RenderOTPPayload = {
  code: string;
  purpose: string;
};

type InvitationTemplatePayload = {
  organizationName: string;
  role?: string;
  projectId?: string;
  customMessage?: string;
  acceptUrl?: string;
  expiresAt?: string;
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
  let projectId = '';
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
      projectId = projectMatch[1].trim();
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
    projectId,
    customMessage: customMessageLines.join('\n').trim(),
    acceptUrl,
    expiresAt,
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
      const invitation = parseInvitationTemplate(subject, message);
      const html = invitation
        ? await render(InvitationEmail(invitation))
        : await render(NotificationEmail({ title: subject, message }));
      return jsonResponse(200, { subject, html, text: message });
    }

    if (req.method === 'POST' && url.pathname === '/render/otp') {
      const raw = await req.text();
      const parsed = parseJSON<RenderOTPPayload>(raw);
      if (!parsed || !parsed.code?.trim() || !parsed.purpose?.trim()) {
        return jsonResponse(400, { error: 'invalid payload' });
      }

      const code = parsed.code.trim();
      const purpose = parsed.purpose.trim();
      const subject = `Code OTP: ${code}`;
      const html = await render(OTPEmail({ code, purpose }));
      const text = `Code OTP: ${code}\nUtilisez ce code pour ${purpose}.`;
      return jsonResponse(200, { subject, html, text });
    }

    return jsonResponse(404, { error: 'not found' });
  },
});
