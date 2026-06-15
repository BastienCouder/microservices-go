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
  const expiresIn = payload.expiresIn?.trim()
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
      ? `OTP code: ${code}\nUse this code to ${purpose}.`
      : `Code OTP: ${code}\nUtilisez ce code pour ${purpose}.`

  return { subject, html, text }
}
