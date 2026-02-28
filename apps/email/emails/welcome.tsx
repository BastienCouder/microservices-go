import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import { tailwindConfig } from './tailwind.config';

interface WelcomeEmailProps {
  firstName: string;
  verificationUrl: string;
}

export default function WelcomeEmail({ firstName, verificationUrl }: WelcomeEmailProps) {
  return (
    <Html lang="fr">
      <Tailwind config={tailwindConfig}>
        <Head />
        <Preview>Confirme ton compte</Preview>
        <Body className="bg-slate-100 py-10 font-sans">
          <Container className="mx-auto max-w-xl rounded-lg bg-white p-8">
            <Heading className="m-0 text-2xl font-semibold text-text">Bienvenue {firstName}</Heading>
            <Text className="mt-4 text-base leading-6 text-text">
              Confirme ton email pour activer ton compte et accéder a toutes les fonctionnalites.
            </Text>
            <Section className="mt-6">
              <Button
                href={verificationUrl}
                className="box-border rounded-md bg-brand px-5 py-3 text-center text-sm font-medium text-white no-underline"
              >
                Confirmer mon email
              </Button>
            </Section>
            <Hr className="border-solid border-slate-200 my-8" />
            <Text className="m-0 text-sm leading-6 text-muted">
              Si tu n'es pas a l'origine de cette demande, tu peux ignorer cet email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

WelcomeEmail.PreviewProps = {
  firstName: 'Bastien',
  verificationUrl: 'https://example.com/verify/abc123',
} satisfies WelcomeEmailProps;
