import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) return transporter

  const config = useRuntimeConfig()

  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort),
    secure: Number(config.smtpPort) === 465, // true for 465, false for other ports
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  })

  return transporter
}

interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const config = useRuntimeConfig()

  // Skip sending in development if no SMTP password configured
  if (!config.smtpPassword) {
    console.log('[Email] SMTP not configured, skipping email send')
    console.log('[Email] To:', options.to)
    console.log('[Email] Subject:', options.subject)
    console.log('[Email] Would send:', options.text.substring(0, 200))
    return true // Return true so flow continues in dev
  }

  try {
    const transport = getTransporter()
    await transport.sendMail({
      from: config.smtpFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })
    return true
  } catch (error) {
    console.error('[Email] Failed to send:', error)
    return false
  }
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  locale: string = 'en',
): Promise<boolean> {
  const config = useRuntimeConfig()
  const verifyUrl = `${config.public.appUrl}/verify-email?token=${token}`

  const subjects = {
    de: 'Bestätige deine E-Mail-Adresse - DM Hero',
    en: 'Verify your email address - DM Hero',
  }

  const texts = {
    de: `Hallo!

Vielen Dank für deine Registrierung bei DM Hero!

Bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:

${verifyUrl}

Der Link ist 24 Stunden gültig.

Falls du dich nicht bei DM Hero registriert hast, kannst du diese E-Mail ignorieren.

Viele Grüße,
Das DM Hero Team`,
    en: `Hello!

Thank you for registering at DM Hero!

Please verify your email address by clicking the following link:

${verifyUrl}

The link is valid for 24 hours.

If you did not register at DM Hero, you can ignore this email.

Best regards,
The DM Hero Team`,
  }

  const htmls = {
    de: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .logo { font-size: 28px; font-weight: bold; color: #D4A574; }
    .button { display: inline-block; background: #D4A574; color: #1A1D29 !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎲 DM Hero</div>
    </div>
    <h2>Willkommen bei DM Hero!</h2>
    <p>Vielen Dank für deine Registrierung! Bitte bestätige deine E-Mail-Adresse, um deinen Account zu aktivieren.</p>
    <p style="text-align: center;">
      <a href="${verifyUrl}" class="button">E-Mail bestätigen</a>
    </p>
    <p style="font-size: 14px; color: #666;">
      Oder kopiere diesen Link in deinen Browser:<br>
      <a href="${verifyUrl}">${verifyUrl}</a>
    </p>
    <p style="font-size: 14px; color: #666;">Der Link ist 24 Stunden gültig.</p>
    <div class="footer">
      <p>Falls du dich nicht bei DM Hero registriert hast, kannst du diese E-Mail ignorieren.</p>
      <p>© ${new Date().getFullYear()} DM Hero - Your D&D Campaign Companion</p>
    </div>
  </div>
</body>
</html>`,
    en: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .logo { font-size: 28px; font-weight: bold; color: #D4A574; }
    .button { display: inline-block; background: #D4A574; color: #1A1D29 !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎲 DM Hero</div>
    </div>
    <h2>Welcome to DM Hero!</h2>
    <p>Thank you for registering! Please verify your email address to activate your account.</p>
    <p style="text-align: center;">
      <a href="${verifyUrl}" class="button">Verify Email</a>
    </p>
    <p style="font-size: 14px; color: #666;">
      Or copy this link to your browser:<br>
      <a href="${verifyUrl}">${verifyUrl}</a>
    </p>
    <p style="font-size: 14px; color: #666;">The link is valid for 24 hours.</p>
    <div class="footer">
      <p>If you did not register at DM Hero, you can ignore this email.</p>
      <p>© ${new Date().getFullYear()} DM Hero - Your D&D Campaign Companion</p>
    </div>
  </div>
</body>
</html>`,
  }

  const lang = locale === 'de' ? 'de' : 'en'

  return sendEmail({
    to: email,
    subject: subjects[lang],
    text: texts[lang],
    html: htmls[lang],
  })
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  locale: string = 'en',
): Promise<boolean> {
  const config = useRuntimeConfig()
  const resetUrl = `${config.public.appUrl}/reset-password?token=${token}`

  const subjects = {
    de: 'Passwort zurücksetzen - DM Hero',
    en: 'Reset your password - DM Hero',
  }

  const texts = {
    de: `Hallo!

Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.

Klicke auf den folgenden Link, um ein neues Passwort zu setzen:

${resetUrl}

Der Link ist 1 Stunde gültig.

Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren. Dein Passwort wird nicht geändert.

Viele Grüße,
Das DM Hero Team`,
    en: `Hello!

You have requested to reset your password.

Click the following link to set a new password:

${resetUrl}

The link is valid for 1 hour.

If you did not request this, you can ignore this email. Your password will not be changed.

Best regards,
The DM Hero Team`,
  }

  const htmls = {
    de: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .logo { font-size: 28px; font-weight: bold; color: #D4A574; }
    .button { display: inline-block; background: #D4A574; color: #1A1D29 !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎲 DM Hero</div>
    </div>
    <h2>Passwort zurücksetzen</h2>
    <p>Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Klicke auf den Button unten, um ein neues Passwort zu setzen.</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">Neues Passwort setzen</a>
    </p>
    <p style="font-size: 14px; color: #666;">
      Oder kopiere diesen Link in deinen Browser:<br>
      <a href="${resetUrl}">${resetUrl}</a>
    </p>
    <p style="font-size: 14px; color: #666;">Der Link ist 1 Stunde gültig.</p>
    <div class="footer">
      <p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren. Dein Passwort wird nicht geändert.</p>
      <p>© ${new Date().getFullYear()} DM Hero - Your D&D Campaign Companion</p>
    </div>
  </div>
</body>
</html>`,
    en: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .logo { font-size: 28px; font-weight: bold; color: #D4A574; }
    .button { display: inline-block; background: #D4A574; color: #1A1D29 !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎲 DM Hero</div>
    </div>
    <h2>Reset Your Password</h2>
    <p>You have requested to reset your password. Click the button below to set a new password.</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">Set New Password</a>
    </p>
    <p style="font-size: 14px; color: #666;">
      Or copy this link to your browser:<br>
      <a href="${resetUrl}">${resetUrl}</a>
    </p>
    <p style="font-size: 14px; color: #666;">The link is valid for 1 hour.</p>
    <div class="footer">
      <p>If you did not request this, you can ignore this email. Your password will not be changed.</p>
      <p>© ${new Date().getFullYear()} DM Hero - Your D&D Campaign Companion</p>
    </div>
  </div>
</body>
</html>`,
  }

  const lang = locale === 'de' ? 'de' : 'en'

  return sendEmail({
    to: email,
    subject: subjects[lang],
    text: texts[lang],
    html: htmls[lang],
  })
}

interface ValidationNotificationOptions {
  adventureTitle: string
  adventureId: number
  authorEmail: string
  authorName: string
  uploadedAt: string
  validatedAt: string
  status: 'published' | 'rejected'
  errors?: Array<{ message: string; field?: string }>
  warnings?: Array<{ message: string }>
}

export async function sendValidationNotificationEmail(
  options: ValidationNotificationOptions,
): Promise<boolean> {
  const config = useRuntimeConfig()
  const adminEmail = config.adminEmail || 'fh@flogersoft.de'

  const statusEmoji = options.status === 'published' ? '✅' : '❌'
  const statusText = options.status === 'published' ? 'Published / Veröffentlicht' : 'Rejected / Abgelehnt'

  const errorsList = options.errors && options.errors.length > 0
    ? options.errors.map((e) => `• ${e.field ? `[${e.field}] ` : ''}${e.message}`).join('\n')
    : 'None / Keine'

  const warningsList = options.warnings && options.warnings.length > 0
    ? options.warnings.map((w) => `• ${w.message}`).join('\n')
    : 'None / Keine'

  const subject = `${statusEmoji} Adventure Validation: ${options.adventureTitle}`

  const text = `Adventure Validation Result / Abenteuer-Validierungsergebnis
═══════════════════════════════════════════════════════════

Adventure / Abenteuer: ${options.adventureTitle}
ID: ${options.adventureId}
Author / Autor: ${options.authorName} (${options.authorEmail})

Uploaded / Hochgeladen: ${options.uploadedAt}
Validated / Validiert: ${options.validatedAt}

Status: ${statusText}

${options.status === 'rejected' ? `Errors / Fehler:
${errorsList}

Warnings / Warnungen:
${warningsList}` : `The adventure has been published successfully.
Das Abenteuer wurde erfolgreich veröffentlicht.`}

---
DM Hero - Hero Basar
${config.public.appUrl}/store`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; margin-bottom: 20px; }
    .logo { font-size: 28px; font-weight: bold; color: #D4A574; }
    .status { font-size: 24px; font-weight: bold; margin: 20px 0; padding: 16px; border-radius: 8px; text-align: center; }
    .status.published { background: #e8f5e9; color: #2e7d32; }
    .status.rejected { background: #ffebee; color: #c62828; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .info-table td { padding: 8px 0; border-bottom: 1px solid #eee; }
    .info-table td:first-child { font-weight: 600; color: #666; width: 40%; }
    .errors { background: #fff3e0; border-left: 4px solid #ff9800; padding: 16px; margin: 16px 0; border-radius: 4px; }
    .errors h4 { margin: 0 0 8px 0; color: #e65100; }
    .errors ul { margin: 0; padding-left: 20px; }
    .success-msg { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 16px; margin: 16px 0; border-radius: 4px; color: #2e7d32; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">🎲 DM Hero - Hero Basar</div>
      </div>

      <div class="status ${options.status}">${statusEmoji} ${statusText}</div>

      <table class="info-table">
        <tr>
          <td>Adventure / Abenteuer</td>
          <td><strong>${options.adventureTitle}</strong></td>
        </tr>
        <tr>
          <td>ID</td>
          <td>${options.adventureId}</td>
        </tr>
        <tr>
          <td>Author / Autor</td>
          <td>${options.authorName}<br><small>${options.authorEmail}</small></td>
        </tr>
        <tr>
          <td>Uploaded / Hochgeladen</td>
          <td>${options.uploadedAt}</td>
        </tr>
        <tr>
          <td>Validated / Validiert</td>
          <td>${options.validatedAt}</td>
        </tr>
      </table>

      ${options.status === 'rejected' ? `
      <div class="errors">
        <h4>❌ Errors / Fehler</h4>
        <ul>
          ${options.errors?.map((e) => `<li>${e.field ? `<strong>[${e.field}]</strong> ` : ''}${e.message}</li>`).join('') || '<li>-</li>'}
        </ul>
      </div>
      ${options.warnings && options.warnings.length > 0 ? `
      <div class="errors" style="background: #fff8e1; border-color: #ffc107;">
        <h4>⚠️ Warnings / Warnungen</h4>
        <ul>
          ${options.warnings.map((w) => `<li>${w.message}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      ` : `
      <div class="success-msg">
        ✅ The adventure has been published successfully and is now visible in the store.<br>
        Das Abenteuer wurde erfolgreich veröffentlicht und ist jetzt im Store sichtbar.
      </div>
      `}

      <div class="footer">
        <p>© ${new Date().getFullYear()} DM Hero - Your D&D Campaign Companion</p>
      </div>
    </div>
  </div>
</body>
</html>`

  return sendEmail({
    to: adminEmail,
    subject,
    text,
    html,
  })
}
