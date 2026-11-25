export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER?.trim() || 'console';

  if (provider === 'console') {
    console.info(
      `\n[CluBar Email (Console Mode)]\nTo: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}\n`
    );
    return;
  }

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim() || 'noreply@clubar.example.com';
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is missing while EMAIL_PROVIDER=resend.');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend API error (${res.status}): ${detail}`);
    }
    return;
  }

  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}
