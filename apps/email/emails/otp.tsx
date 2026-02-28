import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Tailwind,
  Text,
} from '@react-email/components';
import { tailwindConfig } from './tailwind.config';

interface OTPEmailProps {
  code: string;
  purpose: string;
}

export default function OTPEmail({ code, purpose }: OTPEmailProps) {
  return (
    <Html lang="fr">
      <Tailwind config={tailwindConfig}>
        <Head />
        <Preview>Votre code de verification: {code}</Preview>
        <Body className="bg-slate-100 py-10 font-sans">
          <Container className="mx-auto max-w-xl rounded-lg bg-white p-8">
            <Heading className="m-0 text-2xl font-semibold text-text">Code de verification</Heading>
            <Text className="mt-4 text-base leading-6 text-text">
              Utilisez ce code pour {purpose}:
            </Text>
            <Text className="mt-2 text-3xl font-bold tracking-widest text-text">{code}</Text>
            <Text className="mt-4 text-sm text-slate-600">
              Ce code est a usage unique et expire rapidement.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

OTPEmail.PreviewProps = {
  code: '123456',
  purpose: 'vous connecter',
} satisfies OTPEmailProps;
