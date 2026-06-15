import { pixelBasedPreset, type TailwindConfig } from '@react-email/components';

export const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: '#326BC8',
        brandDark: '#21498A',
        brandSoft: '#EFF5FF',
        text: '#0F172A',
        muted: '#64748B',
      },
    },
  },
} satisfies TailwindConfig;
