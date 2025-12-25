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
