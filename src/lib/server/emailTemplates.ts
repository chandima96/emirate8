import 'server-only';

/* Branded account emails. Table layout and inline styles so they render in every mail client. */

const INK = '#16231F';
const MUTED = '#5F6B67';
const LINE = '#E3E7E5';
const PAPER = '#F6F7F5';
const SAGE = '#A9C0AF';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://emirate08.ae').replace(/\/$/, '');
}

function layout({ preheader, body }: { preheader: string; body: string }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Emirate08</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 20px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;color:${INK};">
        Emirate<span style="font-style:italic;font-weight:400;">08</span>
      </td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid ${LINE};border-radius:12px;padding:32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
        ${body}
      </td></tr>
      <tr><td style="padding:20px 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};">
        You received this email because an Emirate08 account was created with this address.<br>
        <a href="${siteUrl()}" style="color:${MUTED};">${siteUrl().replace(/^https?:\/\//, '')}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function confirmationCodeEmail({ name, code }: { name: string; code: string }) {
  const first = escapeHtml((name || '').trim().split(/\s+/)[0] || 'there');
  return {
    subject: `${code} is your Emirate08 confirmation code`,
    text: `Hi ${first},\n\nYour Emirate08 confirmation code is ${code}.\nIt expires in 15 minutes.\n\nIf you didn't create an account, you can ignore this email.`,
    html: layout({
      preheader: `Your confirmation code is ${code}`,
      body: `
        <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;">Confirm your email</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${MUTED};">Hi ${first}, enter this code to confirm your email address and finish creating your account.</p>
        <div style="margin:0 0 24px;padding:18px 0;border-radius:10px;background:${PAPER};border:1px solid ${LINE};text-align:center;font-family:'SFMono-Regular',Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:${INK};">${code}</div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">The code expires in 15 minutes. If you didn't create an Emirate08 account, you can safely ignore this email.</p>`,
    }),
  };
}

export function professionalWelcomeEmail({
  name,
  accountLabel,
  planName,
  amount,
}: {
  name: string;
  accountLabel: string;
  planName: string;
  amount: number | null;
}) {
  const first = escapeHtml((name || '').trim().split(/\s+/)[0] || 'there');
  const price = amount ? `AED ${amount.toLocaleString('en-AE')} / month` : '';
  const dashboard = `${siteUrl()}/dashboard`;
  return {
    subject: `Your Emirate08 ${accountLabel} account is ready`,
    text: `Hi ${first},\n\nYour Emirate08 account is now a ${accountLabel} account on the ${planName} plan${price ? ` (${price})` : ''}.\n\nOur team is reviewing your credentials. While review is pending you can complete your profile and prepare listing drafts. Publishing unlocks once your credentials are verified.\n\nOpen your dashboard: ${dashboard}`,
    html: layout({
      preheader: `Your ${accountLabel} account is ready. Credentials are under review.`,
      body: `
        <div style="width:44px;height:44px;border-radius:22px;background:${SAGE};text-align:center;line-height:44px;font-size:20px;margin:0 0 20px;">&#10003;</div>
        <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;">Welcome to Emirate08 Pro</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">Hi ${first}, your account is now a <strong style="color:${INK};">${escapeHtml(accountLabel)}</strong> account.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${LINE};border-radius:10px;font-size:14px;">
          <tr><td style="padding:12px 16px;color:${MUTED};">Plan</td><td align="right" style="padding:12px 16px;font-weight:600;">${escapeHtml(planName)}</td></tr>
          ${price ? `<tr><td style="padding:12px 16px;border-top:1px solid ${LINE};color:${MUTED};">Membership</td><td align="right" style="padding:12px 16px;border-top:1px solid ${LINE};font-weight:600;">${price}</td></tr>` : ''}
          <tr><td style="padding:12px 16px;border-top:1px solid ${LINE};color:${MUTED};">Credential review</td><td align="right" style="padding:12px 16px;border-top:1px solid ${LINE};font-weight:600;color:#8A5A12;">Pending</td></tr>
        </table>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${MUTED};">While we review your credentials you can complete your profile and prepare listing drafts. Publishing unlocks once you're verified — we'll email you when that happens.</p>
        <a href="${dashboard}" style="display:inline-block;background:${INK};color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:13px 22px;border-radius:8px;">Open your dashboard &rarr;</a>`,
    }),
  };
}
