import { render } from '@react-email/render'
import { getOtpCopy, normalizeLocale, type EmailLocale } from './i18n'
import OTPEmail from './otp'

export type OTPTemplatePayload = {
  code: string
  purpose: string
  expiresIn?: string
  locale?: EmailLocale
}

export async function renderOTPTemplate(payload: OTPTemplatePayload) {
  const locale = normalizeLocale(payload.locale)
  const copy = getOtpCopy(locale)
  const code = payload.code.trim()
  const purpose = payload.purpose.trim() || copy.fallbackPurpose
  const expiresIn = payload.expiresIn?.trim() || copy.fallbackValidity
  const subject = locale === 'en' ? `OTP code: ${code}` : `Code OTP: ${code}`
  const html = await render(
    OTPEmail({
      code,
      purpose,
      expiresIn,
      locale,
    }),
  )
  const text =
    locale === 'en'
      ? [
          `OTP code: ${code}`,
          `Use this code to ${purpose}.`,
          `This code is personal, single-use, and expires in ${expiresIn}.`,
          'Never share this code.',
          'If you did not request this code, you can safely ignore this email.',
        ].join('\n')
      : [
          `Code OTP: ${code}`,
          `Utilisez ce code pour ${purpose}.`,
          `Ce code est personnel, à usage unique, et expire dans ${expiresIn}.`,
          'Ne partagez jamais ce code.',
          "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.",
        ].join('\n')

  return { subject, html, text }
}
