import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import { tailwindConfig } from './tailwind.config';

export interface InvitationEmailProps {
  organizationName: string;
  role?: string;
  projectId?: string;
  customMessage?: string;
  acceptUrl?: string;
  expiresAt?: string;
}

function formatRole(role?: string): string {
  const normalized = role?.trim().toLowerCase();
  switch (normalized) {
    case 'editor':
      return 'Editor';
    case 'viewer':
      return 'Viewer';
    case 'admin':
      return 'Admin';
    case 'owner':
      return 'Owner';
    default:
      return role?.trim() || 'Member';
  }
}

function BrandLogo() {
  return (
    <div className="inline-block rounded-2xl bg-brand px-4 py-3">
      <svg
        width="124"
        height="32"
        viewBox="0 0 268 131"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Brand logo"
      >
        <path
          d="M22.272 102L0.48 32.88H12.384L30.624 90.768L49.104 32.88H61.008L39.216 102H22.272ZM69.18 102V32.88H80.748V102H69.18ZM120.71 103.44C115.654 103.44 111.094 102.56 107.03 100.8C102.998 99.04 99.6703 96.528 97.0463 93.264C94.4543 89.968 92.8063 86.064 92.1023 81.552L104.102 79.728C105.126 83.824 107.222 86.992 110.39 89.232C113.59 91.472 117.27 92.592 121.43 92.592C123.894 92.592 126.214 92.208 128.39 91.44C130.566 90.672 132.326 89.552 133.67 88.08C135.046 86.608 135.734 84.8 135.734 82.656C135.734 81.696 135.574 80.816 135.254 80.016C134.934 79.184 134.454 78.448 133.814 77.808C133.206 77.168 132.406 76.592 131.414 76.08C130.454 75.536 129.334 75.072 128.054 74.688L110.198 69.408C108.662 68.96 106.998 68.368 105.206 67.632C103.446 66.864 101.766 65.824 100.166 64.512C98.5983 63.168 97.3023 61.472 96.2783 59.424C95.2863 57.344 94.7903 54.784 94.7903 51.744C94.7903 47.296 95.9103 43.568 98.1503 40.56C100.422 37.52 103.462 35.248 107.27 33.744C111.11 32.24 115.366 31.504 120.038 31.536C124.774 31.568 128.998 32.384 132.71 33.984C136.422 35.552 139.526 37.84 142.022 40.848C144.518 43.856 146.278 47.488 147.302 51.744L134.87 53.904C134.358 51.472 133.366 49.408 131.894 47.712C130.454 45.984 128.678 44.672 126.566 43.776C124.486 42.88 122.262 42.4 119.894 42.336C117.59 42.304 115.446 42.656 113.462 43.392C111.51 44.096 109.926 45.12 108.71 46.464C107.526 47.808 106.934 49.376 106.934 51.168C106.934 52.864 107.446 54.256 108.47 55.344C109.494 56.4 110.758 57.248 112.262 57.888C113.798 58.496 115.35 59.008 116.918 59.424L129.302 62.88C130.998 63.328 132.902 63.936 135.014 64.704C137.126 65.472 139.158 66.544 141.11 67.92C143.062 69.296 144.662 71.104 145.91 73.344C147.19 75.584 147.83 78.432 147.83 81.888C147.83 85.472 147.078 88.624 145.574 91.344C144.102 94.032 142.102 96.272 139.574 98.064C137.046 99.856 134.15 101.2 130.886 102.096C127.654 102.992 124.262 103.44 120.71 103.44ZM159.18 102V32.88H170.748V102H159.18ZM180.326 102L202.118 32.88H219.062L240.854 102H228.95L209.174 39.984H211.766L192.23 102H180.326ZM192.47 87.024V76.224H228.758V87.024H192.47Z"
          fill="white"
        />
        <circle cx="259.5" cy="95.5" r="8.5" fill="white" />
      </svg>
    </div>
  );
}

export default function InvitationEmail({
  organizationName,
  role,
  projectId,
  customMessage,
  acceptUrl,
  expiresAt,
}: InvitationEmailProps) {
  const cleanOrganizationName = organizationName.trim() || 'votre organisation';
  const cleanMessage = customMessage?.trim();

  return (
    <Html lang="fr">
      <Tailwind config={tailwindConfig}>
        <Head />
        <Preview>Invitation a rejoindre {cleanOrganizationName}</Preview>
        <Body
          className="bg-slate-100 py-10"
          style={{ fontFamily: 'Manrope, Inter, Arial, sans-serif' }}
        >
          <Container className="mx-auto max-w-2xl px-4">
            <Section className="overflow-hidden rounded-[28px] bg-white shadow-2xl">
              <Section className="bg-brand px-8 py-8 text-white">
                <BrandLogo />
                <Text className="mb-0 mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-blue-100">
                  Invitation
                </Text>
                <Heading className="mb-0 mt-3 text-[32px] font-semibold leading-[1.15] text-white">
                  Rejoignez {cleanOrganizationName}
                </Heading>
                <Text className="mb-0 mt-4 text-base leading-7 text-blue-100">
                  Vous avez ete invite a collaborer sur votre espace de pilotage GEO et AI Search.
                </Text>
              </Section>

              <Section className="px-8 py-8">
                <Text className="m-0 text-base leading-7 text-slate-900">
                  Bonjour,
                </Text>
                <Text className="mb-0 mt-4 text-base leading-7 text-slate-700">
                  Une invitation vous attend pour acceder a <strong>{cleanOrganizationName}</strong>.
                  Vous pourrez suivre la visibilite de votre marque, vos prompts et vos analyses
                  depuis un espace partage.
                </Text>

                <Section className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 px-6 py-5">
                  <Text className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                    Acces
                  </Text>
                  <Text className="mb-0 mt-3 text-sm leading-6 text-slate-700">
                    <strong className="text-slate-900">Role:</strong> {formatRole(role)}
                  </Text>
                  {projectId ? (
                    <Text className="mb-0 mt-2 text-sm leading-6 text-slate-700">
                      <strong className="text-slate-900">Projet:</strong> {projectId}
                    </Text>
                  ) : null}
                  {expiresAt ? (
                    <Text className="mb-0 mt-2 text-sm leading-6 text-slate-700">
                      <strong className="text-slate-900">Expiration:</strong> {expiresAt}
                    </Text>
                  ) : null}
                </Section>

                {cleanMessage ? (
                  <Section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5">
                    <Text className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Message
                    </Text>
                    <Text className="mb-0 mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {cleanMessage}
                    </Text>
                  </Section>
                ) : null}

                {acceptUrl ? (
                  <Section className="mt-8">
                    <Button
                      href={acceptUrl}
                      className="box-border rounded-xl bg-brand px-6 py-4 text-center text-sm font-semibold text-white no-underline"
                    >
                      Accepter l'invitation
                    </Button>
                    <Text className="mb-0 mt-4 text-sm leading-6 text-slate-500">
                      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur:
                    </Text>
                    <Link href={acceptUrl} className="mt-2 block break-all text-sm leading-6 text-brand">
                      {acceptUrl}
                    </Link>
                  </Section>
                ) : null}

                <Hr className="my-8 border-solid border-slate-200" />
                <Text className="m-0 text-sm leading-6 text-slate-500">
                  Si vous n'attendiez pas cette invitation, vous pouvez simplement ignorer cet
                  email.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

InvitationEmail.PreviewProps = {
  organizationName: 'Acme',
  role: 'viewer',
  projectId: 'project-vision',
  customMessage: 'Nous aimerions vous ajouter a notre espace de collaboration.',
  acceptUrl: 'https://example.com/invitations/token-123',
  expiresAt: '2026-06-20T12:00:00Z',
} satisfies InvitationEmailProps;
