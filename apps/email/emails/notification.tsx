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

interface NotificationEmailProps {
  title: string;
  message: string;
}

export default function NotificationEmail({ title, message }: NotificationEmailProps) {
  return (
    <Html lang="fr">
      <Tailwind config={tailwindConfig}>
        <Head />
        <Preview>{title}</Preview>
        <Body className="bg-slate-100 py-10 font-sans">
          <Container className="mx-auto max-w-xl rounded-lg bg-white p-8">
            <Heading className="m-0 text-2xl font-semibold text-text">{title}</Heading>
            <Text className="mt-4 whitespace-pre-wrap text-base leading-6 text-text">{message}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

NotificationEmail.PreviewProps = {
  title: 'Nouvelle alerte',
  message: 'Votre facture est prete. Consultez votre espace billing.',
} satisfies NotificationEmailProps;
