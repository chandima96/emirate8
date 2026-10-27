import 'server-only';

import { randomBytes } from 'node:crypto';
import { connect as connectTCP, type Socket } from 'node:net';
import { connect as connectTLS, type TLSSocket } from 'node:tls';

const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-';

export function generateTemporaryPassword(length = 16) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => PASSWORD_CHARS[byte % PASSWORD_CHARS.length]).join('');
}

type SmtpConfig = { host: string; port: number; secure: boolean; username: string; password: string; from: string; appUrl: string };

function smtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST;
  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !username || !password) throw new Error('SMTP email configuration is incomplete.');
  return {
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE.toLowerCase() === 'true' : Number(process.env.SMTP_PORT || 465) === 465,
    username,
    password,
    from: process.env.SMTP_FROM || username,
    appUrl: (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  };
}

function response(socket: Socket, buffer: { value: string }) {
  return new Promise<string>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      buffer.value += chunk.toString('utf8');
      const lines = buffer.value.split('\r\n');
      const finalLine = lines.find((line) => /^\d{3} /.test(line));
      if (!finalLine) return;
      buffer.value = lines.slice(lines.indexOf(finalLine) + 1).join('\r\n');
      socket.off('data', onData);
      socket.off('error', onError);
      if (!/^[23]\d\d /.test(finalLine)) reject(new Error(`SMTP server rejected command: ${finalLine}`));
      else resolve(finalLine);
    };
    const onError = (error: Error) => {
      socket.off('data', onData);
      reject(error);
    };
    socket.on('data', onData);
    socket.once('error', onError);
  });
}

async function command(socket: Socket, buffer: { value: string }, value: string) {
  socket.write(`${value}\r\n`);
  return response(socket, buffer);
}

function htmlEscape(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}

function messageBody(to: string, from: string, name: string, temporaryPassword: string | undefined, appUrl: string, agencyName?: string, invitationToken?: string) {
  const subject = agencyName ? `Your ${agencyName} team account is ready` : 'Your Emirate08 account is ready';
  const loginUrl = invitationToken ? `${appUrl}/agency-invite?token=${encodeURIComponent(invitationToken)}` : `${appUrl}/login?next=%2Fagency-dashboard`;
  const text = [
    `Hello ${name},`,
    '',
    agencyName ? `You have been invited to join ${agencyName} on Emirate08.` : 'An Emirate08 account has been created for you by an administrator.',
    '',
    `Username: ${to}`,
    ...(temporaryPassword ? [`Temporary password: ${temporaryPassword}`] : ['You already have an account. Sign in to accept this invitation.']),
    '',
    `Sign in: ${loginUrl}`,
    '',
    temporaryPassword ? 'Please sign in and change this temporary password immediately.' : 'Sign in to accept this invitation and join the agency team.',
    '',
    'Emirate08',
  ].join('\r\n');
  const safeName = htmlEscape(name);
  const safeEmail = htmlEscape(to);
  const safePassword = temporaryPassword ? htmlEscape(temporaryPassword) : '';
  const safeAgency = agencyName ? htmlEscape(agencyName) : '';
  const headline = agencyName ? `You’re invited to join ${safeAgency}` : 'Your account is ready';
  const intro = agencyName
    ? `You’ve been invited to join <strong>${safeAgency}</strong> on Emirate08. Use the button below to continue.`
    : 'An Emirate08 account has been created for you by an administrator. Use the sign-in details below to get started.';
  const actionLabel = invitationToken ? 'Accept team invitation' : 'Sign in to Emirate08';
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f2f4f0;font-family:Arial,Helvetica,sans-serif;color:#172627;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${agencyName ? `Invitation to join ${safeAgency} on Emirate08.` : 'Your Emirate08 sign-in details are ready.'}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f2f4f0;border-collapse:collapse">
    <tr><td align="center" style="padding:32px 14px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e1e6df;border-radius:16px;overflow:hidden">
        <tr><td style="padding:28px 34px;background:#142326">
          <div style="font-size:20px;line-height:1.2;font-weight:700;letter-spacing:2px;color:#ffffff">EMIRATE<span style="color:#b6c9b3">08</span></div>
          <div style="margin-top:9px;font-size:12px;line-height:1.5;letter-spacing:.5px;color:#d1ddd5">REAL ESTATE, MADE CLEAR</div>
        </td></tr>
        <tr><td style="padding:34px 34px 12px">
          <p style="margin:0 0 10px;font-size:12px;line-height:1.5;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#718175">${agencyName ? 'Team invitation' : 'Account access'}</p>
          <h1 style="margin:0;font-size:27px;line-height:1.25;font-weight:700;color:#172627">${headline}</h1>
          <p style="margin:17px 0 0;font-size:15px;line-height:1.7;color:#586663">Hello ${safeName},<br>${intro}</p>
        </td></tr>
        <tr><td style="padding:18px 34px 8px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;background:#f6f8f4;border:1px solid #e1e7df;border-radius:12px">
            <tr><td style="padding:18px 20px 8px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#718175">${temporaryPassword ? 'Your temporary sign-in details' : 'Your account email'}</td></tr>
            <tr><td style="padding:5px 20px 16px;font-size:14px;line-height:1.65;color:#172627"><strong style="color:#65726d">Email</strong><br><span style="overflow-wrap:anywhere">${safeEmail}</span>${temporaryPassword ? `<br><br><strong style="color:#65726d">Temporary password</strong><br><span style="display:inline-block;margin-top:5px;padding:9px 12px;border:1px solid #dce4db;border-radius:7px;background:#ffffff;font-family:Consolas,Monaco,monospace;font-size:16px;letter-spacing:.5px">${safePassword}</span>` : '<br><span style="color:#65726d">Use your existing password to sign in.</span>'}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 34px 10px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td align="center" bgcolor="#173b36" style="border-radius:8px">
            <a href="${htmlEscape(loginUrl)}" style="display:inline-block;padding:14px 23px;border:1px solid #173b36;border-radius:8px;color:#ffffff;font-size:14px;line-height:1.2;font-weight:700;text-decoration:none">${actionLabel}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:12px 34px 30px">
          <p style="margin:0;font-size:13px;line-height:1.7;color:#687571">${temporaryPassword ? 'For your security, change your temporary password as soon as you sign in.' : 'Sign in with your existing account to accept and join the team.'} If you weren’t expecting this email, you can ignore it or contact your agency.</p>
        </td></tr>
        <tr><td style="padding:18px 34px;border-top:1px solid #e8ece7;background:#fbfcfa">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#7b8781">Emirate08 · Real estate workspace<br>This is an automated account email. Please don’t reply directly.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const boundary = `emirate08_${randomBytes(12).toString('hex')}`;
  const escaped = text.split('\r\n').map((line) => (line.startsWith('.') ? `.${line}` : line)).join('\r\n');
  return [
    `From: Emirate08 <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    escaped,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    `--${boundary}--`,
  ].join('\r\n');
}

export async function sendNewMemberCredentials({ to, name, temporaryPassword, agencyName, invitationToken }: { to: string; name: string; temporaryPassword?: string; agencyName?: string; invitationToken?: string }) {
  const config = smtpConfig();
  const initialSocket = config.secure
    ? connectTLS({ host: config.host, port: config.port, servername: config.host })
    : connectTCP({ host: config.host, port: config.port });
  const buffer = { value: '' };
  const socketConnected = new Promise<void>((resolve, reject) => {
    if (config.secure) (initialSocket as TLSSocket).once('secureConnect', resolve);
    else initialSocket.once('connect', resolve);
    initialSocket.once('error', reject);
  });

  try {
    await socketConnected;
    await response(initialSocket, buffer);
    await command(initialSocket, buffer, `EHLO ${process.env.SMTP_EHLO || 'emirate08.com'}`);
    let socket: TLSSocket;
    if (config.secure) {
      socket = initialSocket as TLSSocket;
    } else {
      await command(initialSocket, buffer, 'STARTTLS');
      socket = await new Promise<TLSSocket>((resolve, reject) => {
        const secured = connectTLS({ socket: initialSocket, servername: config.host });
        secured.once('secureConnect', () => resolve(secured));
        secured.once('error', reject);
      });
      buffer.value = '';
      await command(socket, buffer, `EHLO ${process.env.SMTP_EHLO || 'emirate08.com'}`);
    }
    await command(socket, buffer, 'AUTH LOGIN');
    await command(socket, buffer, Buffer.from(config.username).toString('base64'));
    await command(socket, buffer, Buffer.from(config.password).toString('base64'));
    await command(socket, buffer, `MAIL FROM:<${config.from}>`);
    await command(socket, buffer, `RCPT TO:<${to}>`);
    await command(socket, buffer, 'DATA');
    socket.write(`${messageBody(to, config.from, name, temporaryPassword, config.appUrl, agencyName, invitationToken)}\r\n.\r\n`);
    await response(socket, buffer);
    await command(socket, buffer, 'QUIT');
  } finally {
    initialSocket.end();
  }
}

export function smtpFailureHint(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/SMTP email configuration is incomplete/i.test(message)) return 'SMTP_HOST, SMTP_USER and SMTP_PASSWORD must be configured.';
  if (/(?:SMTP server rejected command: )?(?:535|534)\s|authentication|invalid login|bad credentials/i.test(message)) return 'The SMTP server rejected the credentials. Check SMTP_USER and SMTP_PASSWORD.';
  if (/SMTP server rejected command: (4\d\d|5\d\d)/i.test(message)) return `The SMTP server rejected delivery (${message.match(/SMTP server rejected command: ([^\r\n]+)/i)?.[1] || 'check sender and recipient'}).`;
  if (/ECONN|ETIMEDOUT|EHOST|ENOTFOUND|certificate|TLS|STARTTLS|socket hang up/i.test(message)) return 'Could not establish a secure SMTP connection. Check SMTP_HOST, SMTP_PORT and SMTP_SECURE.';
  return 'SMTP delivery failed. Check the server log for the SMTP error details.';
}
