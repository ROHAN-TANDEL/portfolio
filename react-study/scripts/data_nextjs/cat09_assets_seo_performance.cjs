const { card } = require("../next_builder_helper.cjs");

const cards = [
  card(
    97,
    "`next/image` Architecture: Automated Resizing & WebP/AVIF",
    "Assets, SEO & Performance",
    "Mastery",
    "The `next/image` component replaces standard HTML `<img>` tags with an automated image optimization pipeline. It automatically resizes images to match device viewports, converts them to modern formats (WebP/AVIF), prevents Cumulative Layout Shift (CLS), and enables native lazy-loading.",
    `// app/gallery/page.tsx
import Image from "next/image";
import heroImg from "@/public/hero.jpg"; // Static import automatically provides width & height!

export default function GalleryPage() {
  return (
    <div>
      {/* 1. Statically Imported Image: Width, height, and blurDataURL are inferred */}
      <Image
        src={heroImg}
        alt="Hero Banner"
        placeholder="blur" // Instant low-quality blurred placeholder
        priority // Preloads image for Largest Contentful Paint (LCP) optimization!
        className="rounded-lg shadow"
      />

      {/* 2. Remote Image from S3 / Unsplash: Requires explicit dimensions */}
      <Image
        src="https://images.unsplash.com/photo-1579783902614-a3fb3927b675"
        alt="Art Piece"
        width={800}
        height={600}
        loading="lazy" // Native browser lazy loading
        className="mt-4"
      />
    </div>
  );
}`,
    ["next/image", "AVIF", "WebP", "CLS Prevention", "LCP Optimization"],
    [
      { title: "Next.js Docs: Image Optimization", url: "https://nextjs.org/docs/app/building-your-application/optimizing/images" }
    ],
    "Why must remote image domains be declared in `next.config.js`?",
    "Security. To prevent attackers from using your Next.js image optimization server as an open image resizing proxy for malicious or inappropriate content, Next.js requires explicit domain patterns in `images.remotePatterns`.",
    "What does the `priority` prop do on `<Image />`?",
    "It instructs Next.js to pre-load the image using a `<link rel='preload'>` tag and disables lazy loading. This should be applied to the primary above-the-fold hero image to optimize the Largest Contentful Paint (LCP) metric."
  ),

  card(
    98,
    "Responsive Image Layouts: The `sizes` Attribute & Art Direction",
    "Assets, SEO & Performance",
    "Mastery",
    "When an image's dimensions depend on CSS layouts (e.g. grid columns that adapt from 1 column on mobile to 4 on desktop), using `fill` combined with an accurate `sizes` attribute instructs browsers to download the exact optimal image size rather than a full-resolution 4K asset.",
    `// Responsive Card Grid:
import Image from "next/image";

export function ProductCardImage({ src, alt }: { src: string; alt: string }) {
  return (
    // Parent container must have position: relative and an aspect ratio!
    <div className="relative aspect-video w-full overflow-hidden rounded">
      <Image
        src={src}
        alt={alt}
        fill // Fills the parent container dimensions automatically
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        // Interpretation:
        // - On mobile (< 640px): Image occupies 100% of viewport width
        // - On tablet (< 1024px): Image occupies 50% of viewport width (2-column grid)
        // - On desktop: Image occupies 33% of viewport width (3-column grid)
        className="object-cover"
      />
    </div>
  );
}`,
    ["Responsive Images", "sizes Attribute", "fill Prop", "Bandwidth Optimization", "next/image"],
    [
      { title: "Next.js Docs: Image sizes property", url: "https://nextjs.org/docs/app/api-reference/components/image#sizes" }
    ],
    "What catastrophic performance mistake occurs when using `fill` without specifying the `sizes` attribute?",
    "Next.js defaults `sizes` to `100vw`. Even on a 4-column desktop grid where the image renders at 300px wide, the browser will request an image sized for the user's full 4K screen width (e.g. 3840px), downloading an asset 10x larger than necessary.",
    "What CSS styling is required on the parent element when using the `fill` prop on `<Image />`?",
    "The parent element MUST have `position: relative`, `position: fixed`, or `position: absolute`, and must define an explicit height or aspect ratio."
  ),

  card(
    99,
    "`next/font`: Zero-Layout-Shift Self-Hosting for Google & Local Fonts",
    "Assets, SEO & Performance",
    "Mastery",
    "The `next/font` module downloads and self-hosts Google Fonts and local font files at build time. It completely eliminates Cumulative Layout Shift (CLS) by computing font metric overrides, serving fonts from the same domain without external Google roundtrips.",
    `// app/layout.tsx
import { Inter, Roboto_Mono } from "next/font/google";
import localFont from "next/font/local";

// 1. Google Font: Downloaded and self-hosted automatically at build time!
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

// 2. Custom Local Font:
const myCustomFont = localFont({
  src: "../public/fonts/CustomFont-Bold.woff2",
  display: "swap",
  variable: "--font-custom"
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={\`\${inter.variable} \${myCustomFont.variable}\`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}`,
    ["next/font", "Google Fonts", "Local Fonts", "Zero-Layout-Shift", "CLS Prevention"],
    [
      { title: "Next.js Docs: Font Optimization", url: "https://nextjs.org/docs/app/building-your-application/optimizing/fonts" }
    ],
    "Why is `next/font` superior to traditional `<link href='https://fonts.googleapis.com'>` tags?",
    "Traditional Google Font links trigger external DNS lookups and privacy concerns (GDPR non-compliance). When the font finally downloads, the text re-renders and shifts the layout (CLS). `next/font` downloads font files at build time, hosts them locally, and uses CSS `size-adjust` to match fallback font dimensions perfectly.",
    "What does `display: 'swap'` do in `next/font`?",
    "It uses a system fallback font immediately while the web font loads, ensuring text remains readable immediately without invisible text blocking."
  ),

  card(
    100,
    "Static vs Dynamic Metadata: `metadata` vs `generateMetadata()`",
    "Assets, SEO & Performance",
    "Mastery",
    "Next.js App Router defines SEO metadata using either static configuration (`export const metadata`) or dynamic generation (`export async function generateMetadata()`). Next.js automatically dedupes tags and generates valid `<head>` elements.",
    `// 1. Static Metadata: app/about/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | Acme Corp",
  description: "Enterprise high-scale cloud platforms.",
  openGraph: {
    title: "About Us | Acme Corp",
    images: ["/og-about.png"]
  }
};

// 2. Dynamic Metadata: app/products/[id]/page.tsx
export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });

  if (!product) return { title: "Product Not Found" };

  return {
    title: \`\${product.name} - \$ \${product.price} | Store\`,
    description: product.summary,
    openGraph: {
      title: product.name,
      description: product.summary,
      images: [{ url: product.thumbnailUrl, width: 1200, height: 630 }]
    }
  };
}`,
    ["Metadata", "generateMetadata", "SEO", "OpenGraph", "Dynamic Metadata"],
    [
      { title: "Next.js Docs: Metadata", url: "https://nextjs.org/docs/app/building-your-application/optimizing/metadata" }
    ],
    "Does calling the same database fetch in both `generateMetadata()` and `page.tsx` double the network traffic?",
    "No! React Request Memoization automatically deduplicates identical `fetch()` calls or functions wrapped in `React.cache()` made during the same render pass, so the database is queried only once.",
    "Can `generateMetadata()` be used in `layout.tsx`?",
    "Yes. Layout metadata provides defaults that child pages can inherit or override."
  ),

  card(
    101,
    "Dynamic OpenGraph & Twitter Card Image Generation (`@vercel/og`)",
    "Assets, SEO & Performance",
    "Mastery",
    "Next.js supports programmatic OpenGraph image generation using the `ImageResponse` API (`@vercel/og`). It transforms JSX and Tailwind CSS into high-resolution PNG images dynamically rendered on the edge in milliseconds.",
    `// app/posts/[slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const runtime = "edge"; // Generate at the Edge in < 25ms!
export const alt = "Article OpenGraph Banner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await db.post.findUnique({ where: { slug } });

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundImage: "linear-gradient(to bottom right, #1e293b, #0f172a)",
          padding: "60px",
          color: "white"
        }}
      >
        <span style={{ fontSize: 28, color: "#38bdf8", fontWeight: "bold" }}>
          TECH ENGINEERING BLOG
        </span>
        <h1 style={{ fontSize: 64, fontWeight: "bold", lineHeight: 1.1 }}>
          {post?.title || "Mastering Modern Architecture"}
        </h1>
        <div style={{ display: "flex", gap: "15px", fontSize: 24, color: "#94a3b8" }}>
          <span>By {post?.authorName || "Staff Engineer"}</span>
          <span>• 10 min read</span>
        </div>
      </div>
    ),
    { ...size }
  );
}`,
    ["ImageResponse", "OpenGraph", "Dynamic OG Images", "@vercel/og", "Social Sharing"],
    [
      { title: "Next.js Docs: Dynamic Image Generation", url: "https://nextjs.org/docs/app/api-reference/functions/image-response" }
    ],
    "Why is programmatic OpenGraph generation superior to static PNG templates?",
    "Every blog post, product, or user profile automatically generates a branded, dynamically customized 1200x630 social preview card matching title, author, and price without requiring designers to manually export static graphics.",
    "What subset of CSS is supported by the `ImageResponse` engine?",
    "It uses Satori, a fast SVG-based rendering engine that supports standard Flexbox layout properties, standard font typography, gradients, and a subset of Tailwind CSS styles."
  ),

  card(
    102,
    "Third-Party Script Optimization with `next/script`",
    "Assets, SEO & Performance",
    "Mastery",
    "Third-party analytics and tracking scripts (Google Tag Manager, Segment, Stripe) can severely degrade page performance. The `next/script` component optimizes loading priorities using four execution strategies: `beforeInteractive`, `afterInteractive`, `lazyOnload`, and `worker`.",
    `// app/layout.tsx
import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}

        {/* 1. afterInteractive (Default): Loads immediately after page hydrates (Analytics) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XYZ"
          strategy="afterInteractive"
        />

        {/* 2. lazyOnload: Loads during browser idle time (Customer Chat Widgets) */}
        <Script
          src="https://embed.intercom.io/widget.js"
          strategy="lazyOnload"
        />

        {/* 3. beforeInteractive: Critical scripts injected before Next.js code runs (Bot detectors) */}
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}`,
    ["next/script", "Script Strategies", "beforeInteractive", "afterInteractive", "lazyOnload"],
    [
      { title: "Next.js Docs: Script Optimization", url: "https://nextjs.org/docs/app/building-your-application/optimizing/scripts" }
    ],
    "What is the difference between `afterInteractive` and `lazyOnload` strategies in `next/script`?",
    "`afterInteractive` fetches the script immediately after the page is interactive (ideal for analytics). `lazyOnload` waits until all critical page resources have loaded and the browser CPU enters an idle period (ideal for heavy chat widgets like Intercom).",
    "What does the experimental `worker` strategy in `next/script` do?",
    "It offloads the script execution entirely off the main UI thread into a Web Worker via Partytown, preventing third-party tracking scripts from blocking user clicks and UI rendering."
  ),

  card(
    103,
    "Dynamic Sitemaps (`sitemap.ts`) & Robots Configuration",
    "Assets, SEO & Performance",
    "Mastery",
    "Next.js App Router supports programmatic sitemap and robots generation by declaring `sitemap.ts` and `robots.ts` files at the root of `app/`. Sitemaps can dynamically query databases to list tens of thousands of URLs.",
    `// 1. app/robots.ts
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/private/"]
    },
    sitemap: "https://enterprise.com/sitemap.xml"
  };
}

// 2. app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await db.post.findMany({ select: { slug: true, updatedAt: true } });

  const blogUrls = posts.map(p => ({
    url: \`https://enterprise.com/blog/\${p.slug}\`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8
  }));

  return [
    { url: "https://enterprise.com", lastModified: new Date(), priority: 1.0 },
    { url: "https://enterprise.com/pricing", lastModified: new Date(), priority: 0.9 },
    ...blogUrls
  ];
}`,
    ["sitemap.ts", "robots.ts", "SEO", "Search Engine Indexing", "MetadataRoute"],
    [
      { title: "Next.js Docs: sitemap.xml", url: "https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap" }
    ],
    "How does Next.js handle large sitemaps exceeding Google's 50,000 URL limit?",
    "By exporting a `generateSitemaps()` function that splits URLs into multiple indexed sitemaps (e.g. `/sitemap/0.xml`, `/sitemap/1.xml`), automatically generating a valid sitemap index document.",
    "Are `sitemap.ts` and `robots.ts` automatically served at `/sitemap.xml` and `/robots.txt`?",
    "Yes. Next.js maps the TypeScript files directly to standard search engine endpoints with correct XML and text Content-Type headers."
  ),

  card(
    104,
    "Core Web Vitals Optimization in Next.js: LCP, INP, CLS",
    "Assets, SEO & Performance",
    "Mastery",
    "Core Web Vitals directly determine search engine rankings and user retention: Largest Contentful Paint (LCP < 2.5s), Interaction to Next Paint (INP < 200ms), and Cumulative Layout Shift (CLS < 0.1).",
    `// Core Web Vitals Optimization Matrix:
// 1. LCP (Largest Contentful Paint):
//    - Apply 'priority' on the main above-the-fold next/image.
//    - Avoid render-blocking fonts by using next/font.
//    - Implement Streaming SSR with Suspense so the server flushes initial HTML in < 100ms.

// 2. INP (Interaction to Next Paint):
//    - Shrink client JS bundle by defaulting to React Server Components.
//    - Wrap long CPU computations inside startTransition.
//    - Use next/script strategy="lazyOnload" to prevent third-party scripts from freezing main thread.

// 3. CLS (Cumulative Layout Shift):
//    - Always specify width and height or aspect-ratio on images.
//    - Use next/font to eliminate font swap layout shifts.
//    - Reserve space for dynamic ad banners and Suspense fallback skeletons.`,
    ["Core Web Vitals", "LCP", "INP", "CLS", "Performance Optimization"],
    [
      { title: "Next.js Docs: Optimizing Web Vitals", url: "https://nextjs.org/docs/app/building-your-application/optimizing" }
    ],
    "How does the Interaction to Next Paint (INP) metric differ from the legacy First Input Delay (FID)?",
    "FID measured only the delay on the user's very first interaction during page load. INP measures the responsiveness of ALL user interactions (clicks, keyboard strokes, taps) throughout the entire lifespan of the page session.",
    "How can you track real-world Core Web Vitals directly in a Next.js application?",
    "Use the `useReportWebVitals` hook from `next/web-vitals` in a client component to stream metrics to an analytics endpoint (Datadog, Google Analytics)."
  ),

  card(
    105,
    "Critical CSS Inlining & Tailwind CSS v4 in Next.js",
    "Assets, SEO & Performance",
    "Mastery",
    "Next.js automatically extracts and inlines critical CSS required for initial viewport rendering into `<style>` tags in the HTML document, while deferring non-critical CSS to prevent render blocking.",
    `// app/globals.css (Tailwind CSS v4 Standard)
@import "tailwindcss";

// In Next.js App Router:
// 1. CSS files imported in layouts are automatically code-split per route.
// 2. Tailwind v4 compiles via the Lightning CSS engine at blazing speeds.
// 3. Critical CSS is inlined directly into HTML <head> during SSR streaming,
//    ensuring zero render-blocking stylesheet network roundtrips!`,
    ["Tailwind CSS", "Critical CSS", "CSS Inlining", "Lightning CSS", "Stylesheets"],
    [
      { title: "Next.js Docs: CSS and Styling", url: "https://nextjs.org/docs/app/building-your-application/styling" }
    ],
    "Why does CSS imported inside a nested layout not contaminate sibling layouts?",
    "Next.js scopes and splits CSS bundles according to route boundaries. Styles imported inside `app/dashboard/layout.tsx` are loaded only when the user navigates into `/dashboard` routes."
  ),

  card(
    106,
    "Lazy Loading & Bundle Splitting with `next/dynamic`",
    "Assets, SEO & Performance",
    "Mastery",
    "The `next/dynamic` utility lazily imports Client Components, downloading their JavaScript bundles only when needed (e.g. when an accordion opens or a modal is clicked), drastically reducing the initial page load bundle size.",
    `"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import heavy Monaco code editor (3MB bundle!)
const MonacoEditor = dynamic(() => import("@/components/MonacoEditor"), {
  ssr: false,
  loading: () => <div className="h-96 bg-slate-900 animate-pulse" />
});

export function CodePlayground() {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div>
      <button onClick={() => setShowEditor(true)}>Open Code Editor</button>
      {/* MonacoEditor bundle is downloaded ONLY when button is clicked! */}
      {showEditor && <MonacoEditor />}
    </div>
  );
}`,
    ["next/dynamic", "Lazy Loading", "Code Splitting", "Monaco Editor", "Bundle Optimization"],
    [
      { title: "Next.js Docs: Lazy Loading", url: "https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading" }
    ],
    "Can `next/dynamic` be used inside React Server Components?",
    "No. `next/dynamic` is a client-side bundle splitting utility used inside Client Components. Server Components are naturally code-split by the server on demand without special dynamic wrappers.",
    "What is the difference between `React.lazy` and `next/dynamic`?",
    "`next/dynamic` is a composite wrapper around `React.lazy` and `Suspense` designed specifically for Next.js, providing built-in support for SSR control (`ssr: false`) and custom loading component fallbacks."
  ),

  card(
    107,
    "Link Prefetching Strategies & Disabling Prefetch",
    "Assets, SEO & Performance",
    "Mastery",
    "By default, `<Link>` prefetches linked pages when they enter the viewport. While this makes clicks instantaneous, high-density pages (like an e-commerce grid with 100 links) can generate excessive server load and bandwidth consumption.",
    `import Link from "next/link";

// 1. Default Prefetching (prefetch={null}):
// - Static routes: 100% of the route is prefetched.
// - Dynamic routes: Only the layout and loading skeleton are prefetched.
<Link href="/blog">Blog</Link>

// 2. Explicit Full Prefetch (prefetch={true}):
// Forces prefetching of both static layout AND dynamic RSC payload
<Link href="/checkout" prefetch={true}>Checkout</Link>

// 3. Disable Prefetching (prefetch={false}):
// Prefetching is disabled; payload downloads only on click
<Link href="/heavy-report" prefetch={false}>Heavy Report</Link>`,
    ["Prefetching", "<Link>", "Bandwidth Optimization", "Router Cache", "Resource Savings"],
    [
      { title: "Next.js Docs: Link prefetch prop", url: "https://nextjs.org/docs/app/api-reference/components/link#prefetch" }
    ],
    "When should a developer set `prefetch={false}` on a `<Link>`?",
    "On dense lists (e.g. a table with 500 pagination links), low-priority footer links, or routes backed by expensive computational queries that should execute only when the user intentionally clicks the link."
  ),

  card(
    108,
    "Media & Font Optimization Anti-Patterns",
    "Assets, SEO & Performance",
    "Mastery",
    "Common performance anti-patterns include: 1) Using native `<img>` tags instead of `next/image`, causing massive uncompressed downloads, 2) Forgetting image dimensions, causing Cumulative Layout Shift, and 3) Importing external Google fonts via `@import` in CSS.",
    `// ANTI-PATTERN 1: Un-optimized <img> tag
// <img src="/huge-banner.jpg" /> // Downloads 5MB uncompressed JPEG!

// ANTI-PATTERN 2: External font @import in CSS
// @import url('https://fonts.googleapis.com/css2?family=Inter'); // Blocks render, causes CLS!

// CORRECT PATTERN:
// Use next/font/google and next/image with explicit dimensions:
import Image from "next/image";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });

export function Banner() {
  return (
    <div className={inter.className}>
      <Image src="/huge-banner.jpg" width={1200} height={400} alt="Banner" />
    </div>
  );
}`,
    ["Anti-Patterns", "CLS", "next/image", "Performance Traps", "Web Vitals"],
    [
      { title: "Web.dev: Optimize Cumulative Layout Shift", url: "https://web.dev/optimize-cls/" }
    ],
    "Why does using standard HTML `<img>` tags without dimensions cause Cumulative Layout Shift (CLS)?",
    "The browser doesn't know how much vertical space the image requires before it finishes downloading. When the image suddenly snaps into the page, it pushes all text and buttons down, disorienting the user and penalizing SEO."
  )
];

module.exports = { cards };
