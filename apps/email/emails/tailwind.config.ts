import { pixelBasedPreset, type TailwindConfig } from '@react-email/components';

export const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: '#1d4ed8',
        text: '#111827',
        muted: '#6b7280',
      },
    },
  },
} satisfies TailwindConfig;
