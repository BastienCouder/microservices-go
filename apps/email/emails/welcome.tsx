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
import { normalizeLocale, getWelcomeCopy, type EmailLocale } from './i18n';
import { tailwindConfig } from './tailwind.config';

interface WelcomeEmailProps {
  firstName: string;
  verificationUrl: string;
  locale?: EmailLocale;
}

export default function WelcomeEmail({ firstName, verificationUrl, locale }: WelcomeEmailProps) {
  const normalizedLocale = normalizeLocale(locale);
  const copy = getWelcomeCopy(normalizedLocale);

  return (
    <Html lang={normalizedLocale}>
      <Tailwind config={tailwindConfig}>
        <Head />
        <Preview>{copy.preview}</Preview>
        <Body className="bg-slate-100 py-10 font-sans">
          <Container className="mx-auto max-w-xl rounded-lg bg-white p-8">
            <Heading className="m-0 text-2xl font-semibold text-text">{copy.heading(firstName)}</Heading>
            <Text className="mt-4 text-base leading-6 text-text">{copy.body}</Text>
            <Section className="mt-6">
              <Button
                href={verificationUrl}
                className="box-border rounded-md bg-brand px-5 py-3 text-center text-sm font-medium text-white no-underline"
              >
                {copy.cta}
              </Button>
            </Section>
            <Hr className="border-solid border-slate-200 my-8" />
            <Text className="m-0 text-sm leading-6 text-muted">{copy.footer}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

WelcomeEmail.PreviewProps = {
  firstName: 'Bastien',
  verificationUrl: 'https://example.com/verify/abc123',
  locale: 'fr',
} satisfies WelcomeEmailProps;
