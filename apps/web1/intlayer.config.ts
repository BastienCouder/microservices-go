import type { IntlayerConfig } from "intlayer";

const config: IntlayerConfig = {
  build: {
    optimize: false,
  },
  internationalization: {
    locales: ["fr"],
    defaultLocale: "fr",
  },
};

export default config;
