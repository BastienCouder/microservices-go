import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components"
import { getOtpCopy, normalizeLocale, type EmailLocale } from "./i18n"
import { tailwindConfig } from "./tailwind.config"

export interface OTPEmailProps {
  code: string
  purpose: string
  expiresIn?: string
  locale?: EmailLocale
}

/**
 * Tiny technical label, monospace + wide tracking.
 */
function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="m-0 font-mono text-xs font-medium uppercase leading-4 tracking-widest text-slate-400">
      {children}
    </Text>
  )
}

export default function OTPEmail({
  code,
  purpose,
  expiresIn,
  locale,
}: OTPEmailProps) {
  const normalizedLocale = normalizeLocale(locale)
  const copy = getOtpCopy(normalizedLocale)
  const cleanCode = code?.trim() || "000000"
  const cleanPurpose = purpose?.trim() || copy.fallbackPurpose
  const validity = expiresIn?.trim() || copy.fallbackValidity

  return (
    <Html lang={normalizedLocale}>
      <Head>
        <Font
          fontFamily="Manrope"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/manrope/v15/xn7gYHE41ni1AdIRggexSg.woff2",
            format: "woff2",
          }}
          fontWeight={300}
          fontStyle="normal"
        />

        <Font
          fontFamily="Manrope"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/manrope/v15/xn7gYHE41ni1AdIRggmxSg.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
      </Head>

      <Tailwind config={tailwindConfig}>
        <Preview>{copy.preview(cleanCode)}</Preview>

        <Body className="m-0 bg-slate-50 px-4 py-12 font-sans">
          <Container className="mx-auto w-full max-w-xl overflow-hidden bg-white">
            <Section className="px-10 pt-9">
              <Row>
                <Column>
                  <Text className="m-0 text-base font-semibold tracking-tighter text-slate-900">
                    VISIA<span className="text-brand">.</span>
                  </Text>
                </Column>
              </Row>
            </Section>

            <Section className="px-10 pt-8">
              <Heading className="m-0 mt-5 text-4xl font-light leading-none tracking-tighter text-slate-900">
                {copy.heading}
                <br />
                <span className="font-light text-brand">{copy.headingHighlight}</span>
              </Heading>

              <Text className="m-0 mt-6 max-w-md text-base leading-7 text-slate-600">
                {copy.introPrefix}{" "}
                <span className="font-semibold text-slate-900">{cleanPurpose}</span>
                {`. ${copy.introSuffix}`}
              </Text>
            </Section>

            <Section className="px-10 pt-10">
              <MonoLabel>{copy.monoLabel}</MonoLabel>

              <div className="mt-3 border-0 border-t border-solid border-slate-200" />

              <Text className="m-0 mt-6 font-mono text-5xl font-semibold leading-none tracking-[0.28em] text-slate-900">
                {cleanCode}
              </Text>

              <Text className="m-0 mt-5 max-w-md text-sm leading-6 text-slate-500">
                {copy.validityPrefix}{" "}
                <span className="font-semibold text-slate-700">{validity}</span>.
              </Text>
            </Section>

            <Section className="px-10 pt-10">
              <MonoLabel>{copy.safetyLabel}</MonoLabel>

              <Text className="m-0 mt-3 text-base leading-7 text-slate-700">
                {copy.safetyBody}
              </Text>
            </Section>

            <Section className="px-10 pb-10 pt-10">
              <div className="border-0 border-t border-solid border-slate-200" />

              <Row className="pt-6">
                <Column className="align-top">
                  <Text className="m-0 text-base font-semibold tracking-tighter text-slate-900">
                    VISIA<span className="text-brand">.</span>
                  </Text>

                  <Text className="m-0 mt-2 max-w-sm text-xs leading-5 text-slate-500">
                    {copy.footerTagline}
                  </Text>
                </Column>

                <Column className="text-right align-top">
                  <Text className="m-0 font-mono text-xs uppercase leading-5 tracking-widest text-slate-400">
                    {`© ${new Date().getFullYear()}`}
                    <br />
                    {copy.footerRights}
                  </Text>
                </Column>
              </Row>

              <Text className="m-0 mt-6 text-xs leading-5 text-slate-400">
                {copy.footerIgnore}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

OTPEmail.PreviewProps = {
  code: "123456",
  purpose: "vous connecter",
  expiresIn: "10 minutes",
  locale: "fr",
} satisfies OTPEmailProps
