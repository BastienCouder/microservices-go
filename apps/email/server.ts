import { render } from '@react-email/render';
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
      const html = await render(NotificationEmail({ title: subject, message }));
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
