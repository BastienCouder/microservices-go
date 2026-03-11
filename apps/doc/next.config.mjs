import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const config = {
  output: "standalone",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default withMDX(config);
