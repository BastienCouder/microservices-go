import { useEffect, useState } from "react";

/**
 * A hook for managing the document title with automatic cleanup
 *
 * @example
 * ```tsx
 * // Set and update the page title based on component state
 * const ProductPage = ({ product }) => {
 *   useDocumentTitle(`${product.name} - My Store`);
 *
 *   return (
 *     <div>
 *       <h1>{product.name}</h1>
 *       <p>{product.description}</p>
 *     </div>
 *   );
 * };
 * ```
 */
export function useDocumentTitle(title: string): void {
  const [originalTitle] = useState(document.title);

  useEffect(() => {
    document.title = title;

    return () => {
      document.title = originalTitle;
    };
  }, [title, originalTitle]);
}

/**
 * A hook for managing document meta tags (SEO)
 *
 * @example
 * ```tsx
 * // Set page meta tags for SEO
 * const BlogPost = ({ post }) => {
 *   useMetaTags({
 *     title: post.title,
 *     description: post.excerpt,
 *     image: post.featuredImage,
 *     url: `https://myblog.com/posts/${post.slug}`,
 *   });
 *
 *   return (
 *     <article>
 *       <h1>{post.title}</h1>
 *       <div dangerouslySetInnerHTML={{ __html: post.content }} />
 *     </article>
 *   );
 * };
 * ```
 */
export function useMetaTags({
  title,
  description,
  image,
  url,
}: {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}): void {
  useEffect(() => {
    // Store original values
    const originalTitle = document.title;
    const originalDescription =
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content") || "";
    const originalOgTitle =
      document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute("content") || "";
    const originalOgDescription =
      document
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content") || "";
    const originalOgImage =
      document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content") || "";
    const originalOgUrl =
      document
        .querySelector('meta[property="og:url"]')
        ?.getAttribute("content") || "";

    // Update meta tags if values are provided
    if (title) {
      document.title = title;
      updateMetaTag("og:title", title);
      updateMetaTag("twitter:title", title);
    }

    if (description) {
      updateMetaTag("description", description);
      updateMetaTag("og:description", description);
      updateMetaTag("twitter:description", description);
    }

    if (image) {
      updateMetaTag("og:image", image);
      updateMetaTag("twitter:image", image);
    }

    if (url) {
      updateMetaTag("og:url", url);
    }

    // Helper function to update or create meta tags
    function updateMetaTag(name: string, content: string): void {
      const property = name.includes(":") ? "property" : "name";
      let meta = document.querySelector(`meta[${property}="${name}"]`);

      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(property, name);
        document.head.appendChild(meta);
      }

      meta.setAttribute("content", content);
    }

    // Cleanup function to restore original meta tags
    return () => {
      document.title = originalTitle;

      if (originalDescription) {
        updateMetaTag("description", originalDescription);
      }

      if (originalOgTitle) {
        updateMetaTag("og:title", originalOgTitle);
      }

      if (originalOgDescription) {
        updateMetaTag("og:description", originalOgDescription);
      }

      if (originalOgImage) {
        updateMetaTag("og:image", originalOgImage);
      }

      if (originalOgUrl) {
        updateMetaTag("og:url", originalOgUrl);
      }
    };
  }, [title, description, image, url]);
}
