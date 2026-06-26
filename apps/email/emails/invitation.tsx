import {
  Body,
  Button,
  Column,
  Container,
  Font,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components"
import {
  formatDateByLocale,
  formatRoleByLocale,
  getInvitationCopy,
  normalizeLocale,
  type EmailLocale,
} from "./i18n"
import { tailwindConfig } from "./tailwind.config"

export interface InvitationEmailProps {
  organizationName: string
  inviterName?: string
  role?: string
  projectName?: string
  projectId?: string
  customMessage?: string
  acceptUrl?: string
  expiresAt?: string
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

/**
 * A single row of the access spec sheet.
 */
function SpecRow({
  index,
  label,
  value,
  last,
}: {
  index: string
  label: string
  value: string
  last?: boolean
}) {
  return (
    <Row
      className={`border-0 border-solid border-slate-200 ${
        last ? "" : "border-b"
      }`}
    >
      <Column className="py-4 align-baseline" width={56}>
        <Text className="m-0 font-mono text-xs font-semibold uppercase leading-4 tracking-widest text-brand">
          {index}
        </Text>
      </Column>

      <Column className="py-4 align-baseline">
        <Text className="m-0 font-mono text-xs font-medium uppercase leading-4 tracking-widest text-slate-400">
          {label}
        </Text>
      </Column>

      <Column className="py-4 text-right align-baseline">
        <Text className="m-0 text-sm font-semibold leading-5 tracking-tight text-slate-900">
          {value}
        </Text>
      </Column>
    </Row>
  )
}

export default function InvitationEmail({
  organizationName,
  inviterName,
  role,
  projectName,
  projectId,
  customMessage,
  acceptUrl,
  expiresAt,
  locale,
}: InvitationEmailProps) {
  const normalizedLocale = normalizeLocale(locale)
  const copy = getInvitationCopy(normalizedLocale)
  const org = organizationName?.trim() || copy.defaultOrganization
  const message = customMessage?.trim()
  const expiry = expiresAt ? formatDateByLocale(expiresAt, normalizedLocale) : undefined
  const invitedBy = inviterName?.trim()

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
        <Preview>{copy.preview(org, invitedBy)}</Preview>

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
                {copy.headingHighlightPrefix}{" "}
                <span className="font-light text-brand">{org}</span>
              </Heading>

              <Text className="m-0 mt-6 max-w-md text-base leading-7 text-slate-600">
                {invitedBy ? (
                  <>
                    <span className="font-semibold text-slate-900">{invitedBy}</span>
                    {` ${copy.invitedBodyWithInviter}`}
                  </>
                ) : (
                  copy.invitedBodyWithoutInviter
                )}
                {copy.invitedBodySuffix}
              </Text>

              {acceptUrl ? (
                <Section className="mt-8">
                  <Button
                    href={acceptUrl}
                    className="box-border rounded-full bg-brand px-7 py-3 text-center text-sm font-semibold leading-5 text-white no-underline"
                  >
                    {copy.acceptButton}
                  </Button>
                </Section>
              ) : null}
            </Section>

            <Section className="px-10 pt-10">
              <MonoLabel>{copy.accessDetails}</MonoLabel>

              <div className="mt-3 border-0 border-t border-solid border-slate-200" />

              <SpecRow
                index="01"
                label={copy.roleLabel}
                value={formatRoleByLocale(role, normalizedLocale)}
              />

              <SpecRow
                index="02"
                label={copy.projectLabel}
                value={projectName?.trim() || projectId?.trim() || copy.allProjects}
              />

              <SpecRow
                index="03"
                label={copy.validityLabel}
                value={expiry ? copy.validUntil(expiry) : copy.noExpiry}
                last
              />
            </Section>

            {message ? (
              <Section className="px-10 pt-10">
                  <Text className="m-0 mt-3 whitespace-pre-wrap text-base leading-7 text-slate-700">
                    {message}
                  </Text>
         
              </Section>
            ) : null}

            {acceptUrl ? (
              <Section className="px-10 pt-10">
                <MonoLabel>{copy.directLink}</MonoLabel>

                <Link
                  href={acceptUrl}
                  className="mt-2 block break-all font-mono text-xs leading-5 text-brand no-underline"
                >
                  {acceptUrl}
                </Link>
              </Section>
            ) : null}

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

InvitationEmail.PreviewProps = {
  organizationName: "Acme",
  inviterName: "Camille Laurent",
  role: "editor",
  projectName: "Nike — Visibilité IA",
  customMessage:
    "On démarre le suivi de visibilité de la marque ce mois-ci. Rejoins l'espace pour voir les premiers rapports.",
  acceptUrl: "https://app.visia.io/invitations/token-123",
  expiresAt: "2026-06-20T12:00:00Z",
  locale: "fr",
} satisfies InvitationEmailProps
