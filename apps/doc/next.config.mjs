import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const config = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default withMDX(config);
