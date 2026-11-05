// scripts/examples_nextjs/part5_recipes_43_to_52.cjs
module.exports = [
  {
    id: "next-ex-43",
    title: "Dynamic OpenGraph Image Generation using ImageResponse (@vercel/og)",
    category: "Assets & SEO",
    difficulty: "Advanced",
    whatThisCodeCovers: "Creating dynamic, branded social preview cards (og:image) at the edge using JSX, Tailwind CSS, and @vercel/og ImageResponse.",
    conceptsCovered: ["ImageResponse", "OpenGraph", "Edge Runtime", "Dynamic Social Cards", "satori"],
    code: `// app/api/og/route.tsx
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse dynamic parameters with safe fallbacks
    const title = searchParams.get('title')?.slice(0, 100) || 'Next.js 15 Mastery Guide';
    const author = searchParams.get('author') || 'Architect Team';
    const tag = searchParams.get('tag') || 'Architecture';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#0f172a',
            padding: '60px 80px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Top Tag & Brand */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                padding: '8px 20px',
                borderRadius: '9999px',
                fontSize: 22,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {tag}
            </span>
          </div>

          {/* Center Main Title */}
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>

          {/* Bottom Footer Info */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              borderTop: '2px solid #334155',
              paddingTop: '24px',
              fontSize: 24,
              color: '#94a3b8',
            }}
          >
            <span>By {author}</span>
            <span>nextjs.enterprise.org</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response('Failed to generate OG image', { status: 500 });
  }
}`,
    breakdown: [
      "ImageResponse: Leverages Satori to transform React JSX into SVG and Resvg to convert SVG to high-performance PNG at the edge.",
      "runtime = 'edge': Executes within V8 isolates with instant sub-millisecond cold start times.",
      "Automatically integrated into app/blog/[slug]/layout.tsx via metadata.openGraph.images array."
    ],
    expectedOutput: "Generates a crisp 1200x630 PNG social preview image on the fly with custom title and author."
  },
  {
    id: "next-ex-44",
    title: "Zero-Layout-Shift Self-Hosted Font Architecture with next/font",
    category: "Assets & SEO",
    difficulty: "Intermediate",
    whatThisCodeCovers: "Using next/font/google and next/font/local to download fonts at build time, self-host them, and eliminate Cumulative Layout Shift (CLS).",
    conceptsCovered: ["next/font", "CLS Prevention", "CSS Variables", "Font Subsetting", "next/font/local"],
    code: `// app/fonts.ts
import { Inter, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';

// Google font: Downloaded at build time and hosted locally from same origin
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

// Custom enterprise corporate font from local WOFF2 files
export const customBrandFont = localFont({
  src: [
    {
      path: '../public/fonts/BrandFont-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/BrandFont-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-brand',
  display: 'swap',
});

// app/layout.tsx
import { inter, jetbrainsMono, customBrandFont } from './fonts';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={\`\${inter.variable} \${jetbrainsMono.variable} \${customBrandFont.variable}\`}
    >
      <body className="font-sans antialiased text-neutral-900 bg-white">
        {children}
      </body>
    </html>
  );
}`,
    breakdown: [
      "Zero external network requests: Google fonts are bundled at build time; zero requests are sent to Google servers by end users.",
      "Font Subsetting: subsets: ['latin'] automatically trims unused character glyphs, drastically reducing font file size.",
      "Automatic Size-Adjust Fallbacks: Next.js calculates fallback metrics and injects @font-face adjustments to prevent CLS layout shifts."
    ],
    expectedOutput: "Fastest possible font loading with zero external DNS lookups and zero Cumulative Layout Shift."
  },
  {
    id: "next-ex-45",
    title: "Responsive Art-Directed Image Grid with next/image & sizes Attribute",
    category: "Assets & SEO",
    difficulty: "Intermediate",
    whatThisCodeCovers: "Optimizing responsive images using next/image with strict sizes hints, AVIF/WebP conversion, and blur placeholders.",
    conceptsCovered: ["next/image", "sizes attribute", "AVIF/WebP", "Blur Placeholders", "Responsive Images"],
    code: `// components/ProductGrid.tsx
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  imageUrl: string;
  blurDataUrl: string;
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
      {products.map((product, idx) => (
        <div key={product.id} className="group flex flex-col border rounded-lg overflow-hidden">
          {/* Responsive Image Container with fixed Aspect Ratio */}
          <div className="relative aspect-square w-full bg-neutral-100">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              // sizes hint: Informs browser which srcset image width to fetch based on viewport
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority={idx < 4} // Preload above-the-fold images to optimize LCP
              placeholder="blur"
              blurDataURL={product.blurDataUrl}
            />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-lg">{product.name}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}`,
    breakdown: [
      "sizes: Critical attribute that tells the browser exact render width before CSS is downloaded, stopping 4K images loading on mobile.",
      "priority={idx < 4}: LCP optimization that marks above-the-fold images with fetchpriority='high' and preloads them.",
      "placeholder='blur': Eliminates empty white flashes while high-resolution image downloads over slow networks."
    ],
    expectedOutput: "Near-instant Largest Contentful Paint (LCP) with perfect responsive image width selection."
  },
  {
    id: "next-ex-46",
    title: "Third-Party Script Optimization with next/script Strategies",
    category: "Assets & SEO",
    difficulty: "Intermediate",
    whatThisCodeCovers: "Loading analytics and tag managers using next/script strategies (beforeInteractive, afterInteractive, lazyOnload, worker).",
    conceptsCovered: ["next/script", "beforeInteractive", "lazyOnload", "Web Workers", "Partytown"],
    code: `// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* 1. Critical Polyfill / Bot Defense: Must execute BEFORE page becomes interactive */}
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        {children}

        {/* 2. Core Analytics: Loads immediately after the page hydrates (default strategy) */}
        <Script
          id="google-tag-manager"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: \`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-XXXXXXX');
            \`,
          }}
        />

        {/* 3. Non-critical Chat Widget: Defers execution until browser idle time */}
        <Script
          src="https://static.chatwidget.io/bundle.js"
          strategy="lazyOnload"
          onLoad={() => {
            console.log('Customer support chat widget loaded in idle time.');
          }}
        />
      </body>
    </html>
  );
}`,
    breakdown: [
      "beforeInteractive: Injected into initial HTML and executed prior to hydration (for bot protection, security guards).",
      "afterInteractive (default): Loaded immediately after React hydrates the client DOM, preventing main-thread blocking during initial paint.",
      "lazyOnload: Uses requestIdleCallback to execute during browser idle periods, preserving 100/100 Lighthouse performance scores."
    ],
    expectedOutput: "Prioritizes critical app bundles while running heavyweight third-party scripts without blocking main thread."
  },
  {
    id: "next-ex-47",
    title: "Dynamic Programmatic Sitemap (sitemap.ts) & Robots (robots.ts)",
    category: "Assets & SEO",
    difficulty: "Intermediate",
    whatThisCodeCovers: "Generating dynamic XML sitemaps and robots.txt files programmatically in Next.js 15 App Router.",
    conceptsCovered: ["sitemap.ts", "robots.ts", "MetadataRoute", "Dynamic SEO", "Search Engine Indexing"],
    code: `// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://enterprise.acme.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/checkout/', '/_tenants/'],
      },
      {
        userAgent: 'GPTBot',
        disallow: ['/'], // Disallow AI crawlers if proprietary data
      },
    ],
    sitemap: \`\${baseUrl}/sitemap.xml\`,
  };
}

// app/sitemap.ts
import { MetadataRoute } from 'next';
import { db } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://enterprise.acme.com';

  // 1. Fetch all published dynamic articles from database
  const articles = await db.article.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
  });

  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: \`\${baseUrl}/articles/\${article.slug}\`,
    lastModified: article.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // 2. Static primary marketing pages
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: \`\${baseUrl}/pricing\`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ];

  return [...staticEntries, ...articleEntries];
}`,
    breakdown: [
      "MetadataRoute.Robots and MetadataRoute.Sitemap are typed native Next.js file conventions.",
      "Next.js automatically compiles app/sitemap.ts into /sitemap.xml and app/robots.ts into /robots.txt.",
      "Asynchronous database fetching ensures sitemaps always reflect real-time published database records."
    ],
    expectedOutput: "Serves valid /robots.txt and /sitemap.xml with dynamic database-driven product URLs."
  },
  {
    id: "next-ex-48",
    title: "Application Telemetry Initialization via instrumentation.ts & OpenTelemetry",
    category: "Deployment & Production",
    difficulty: "Advanced",
    whatThisCodeCovers: "Configuring instrumentation.ts hook to initialize distributed tracing, Prometheus metrics, and OpenTelemetry in Next.js 15.",
    conceptsCovered: ["instrumentation.ts", "register() hook", "OpenTelemetry", "Distributed Tracing", "Node Runtime"],
    code: `// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true, // Enable instrumentation hook
  },
};

export default nextConfig;

// instrumentation.ts
export async function register() {
  // Only execute within Node.js runtime (skipping Edge/browser)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = await import('@opentelemetry/resources');
    const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');

    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'nextjs-enterprise-frontend',
        [SemanticResourceAttributes.SERVICE_VERSION]: '15.0.0',
        environment: process.env.NODE_ENV,
      }),
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://collector:4318/v1/traces',
      }),
    });

    sdk.start();
    console.log('[Telemetry] OpenTelemetry SDK initialized successfully in Node runtime.');
  }
}`,
    breakdown: [
      "instrumentation.ts is invoked once when the Next.js server instance starts, before handling any HTTP traffic.",
      "process.env.NEXT_RUNTIME === 'nodejs' ensures heavy telemetry libraries are only loaded in Node.js server environments.",
      "Seamlessly connects Next.js server actions, route handlers, and rendering spans to Jaeger, Datadog, or Grafana Tempo."
    ],
    expectedOutput: "Starts OpenTelemetry tracing on server boot without impacting client bundle or edge latency."
  },
  {
    id: "next-ex-49",
    title: "Multi-Stage Hardened Production Dockerfile with output: 'standalone'",
    category: "Deployment & Production",
    difficulty: "Advanced",
    whatThisCodeCovers: "Creating a production Docker container using Next.js standalone mode to reduce image size from 1.5GB to under 120MB.",
    conceptsCovered: ["Dockerfile", "output: 'standalone'", "Multi-Stage Build", "Non-root User", "Container Security"],
    code: `// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Traces all dependencies and outputs minimal server.js
};

export default nextConfig;

# Dockerfile
FROM node:20-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Minimal Production Runner (<120MB)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Security: Run as unprivileged non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets and traced standalone server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]`,
    breakdown: [
      "output: 'standalone': Analyzes AST imports and bundles ONLY required node_modules into .next/standalone.",
      "Multi-stage Docker build avoids shipping devDependencies or build tooling into the final production image.",
      "Runs under unprivileged 'nextjs' UID 1001 with read-only root permissions for SOC2 / PCI-DSS compliance."
    ],
    expectedOutput: "Creates a hardened, lightweight Docker container (~115MB) running via 'node server.js'."
  },
  {
    id: "next-ex-50",
    title: "Shared Redis CacheHandler for Multi-Container Kubernetes Deployments",
    category: "Deployment & Production",
    difficulty: "Advanced",
    whatThisCodeCovers: "Configuring a custom cacheHandler in next.config.ts with Redis to synchronize ISR and Data Cache across horizontally scaled pods.",
    conceptsCovered: ["cacheHandler", "Redis", "Distributed Caching", "Kubernetes", "Data Cache Sync"],
    code: `// cache-handler.mjs
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_CACHE_URL || 'redis://redis-cluster:6379',
});

client.on('error', (err) => console.error('[CacheHandler] Redis Error:', err));
await client.connect();

export default class RedisCacheHandler {
  constructor(options) {
    this.options = options;
  }

  async get(key) {
    const data = await client.get(\`next:cache:\${key}\`);
    if (!data) return null;
    return JSON.parse(data);
  }

  async set(key, data, ctx) {
    // ctx.revalidate defines TTL in seconds
    const ttl = typeof ctx?.revalidate === 'number' ? ctx.revalidate : 86400;
    await client.setEx(\`next:cache:\${key}\`, ttl, JSON.stringify(data));
  }

  async revalidateTag(tag) {
    // Scan and invalidate all keys associated with this tag in Redis
    const keys = await client.sMembers(\`next:tags:\${tag}\`);
    if (keys.length > 0) {
      await client.del(keys.map((k) => \`next:cache:\${k}\`));
      await client.del(\`next:tags:\${tag}\`);
    }
  }
}

// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheHandler: process.env.NODE_ENV === 'production' 
    ? require.resolve('./cache-handler.mjs') 
    : undefined,
};

export default nextConfig;`,
    breakdown: [
      "Eliminates pod-local cache divergence where pod A serves fresh data while pod B serves stale data.",
      "cacheHandler overrides the default in-memory / local filesystem Data Cache with centralized Redis cluster.",
      "revalidateTag instantly propagates across hundreds of Kubernetes Next.js pods in real time."
    ],
    expectedOutput: "Instant cluster-wide cache invalidation across all Kubernetes replicas when revalidateTag is called."
  },
  {
    id: "next-ex-51",
    title: "Nginx Reverse Proxy Configuration for Static _next/static Caching",
    category: "Deployment & Production",
    difficulty: "Advanced",
    whatThisCodeCovers: "Hardening Nginx reverse proxy to cache immutable Next.js static assets with 1-year max-age while bypassing SSR HTML.",
    conceptsCovered: ["Nginx", "Reverse Proxy", "Cache-Control: immutable", "Static Asset Caching", "Micro-Caching"],
    code: `# /etc/nginx/conf.d/nextjs.conf

upstream nextjs_upstream {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
    keepalive 64;
}

server {
    listen 80;
    server_name store.enterprise.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name store.enterprise.com;

    ssl_certificate /etc/ssl/certs/store.crt;
    ssl_certificate_key /etc/ssl/private/store.key;

    # 1. Next.js Immutable Static Chunks: Cache forever (1 year)
    location /_next/static/ {
        proxy_pass http://nextjs_upstream;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # Next.js hashes these files uniquely per build
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # 2. Public Static Assets (favicons, robots, fonts)
    location ~* \\.(ico|png|jpg|jpeg|svg|webp|woff2)$ {
        proxy_pass http://nextjs_upstream;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # 3. Dynamic SSR, Route Handlers, and Server Actions: Never cache HTML at proxy
    location / {
        proxy_pass http://nextjs_upstream;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSockets and SSE streaming support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_buffering off; # Required for RSC streaming chunks
        proxy_read_timeout 60s;
    }
}`,
    breakdown: [
        "/_next/static/ with immutable max-age=31536000 prevents re-requesting hashed JavaScript/CSS chunks.",
        "proxy_buffering off: Essential for Next.js App Router streaming (React Suspense chunks won't stall in Nginx buffer).",
        "proxy_set_header Connection 'upgrade' enables real-time WebSockets and SSE streaming route handlers."
    ],
    expectedOutput: "Nginx offloads 90% of traffic by serving static assets from memory while streaming SSR HTML without lag."
  },
  {
    id: "next-ex-52",
    title: "Graceful Shutdown & In-Flight Request Draining Script for Kubernetes",
    category: "Deployment & Production",
    difficulty: "Advanced",
    whatThisCodeCovers: "Implementing graceful SIGTERM and SIGINT handling in custom server or standalone Next.js container to prevent dropped user requests.",
    conceptsCovered: ["SIGTERM", "Graceful Shutdown", "Kubernetes PreStop", "Connection Draining", "Zero-Downtime Deployments"],
    code: `// server.mjs (Custom Standalone Next.js Runner with Connection Draining)
import http from 'http';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = parseInt(process.env.PORT || '3000', 10);

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  server.listen(port, () => {
    console.log(\`[Server] Next.js ready on http://localhost:\${port}\`);
  });

  // Track active keep-alive sockets
  const sockets = new Set();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  // Graceful shutdown handler
  async function shutdown(signal) {
    console.log(\`[Shutdown] Received \${signal}. Starting graceful drain...\`);

    // 1. Stop accepting new connections
    server.close((err) => {
      if (err) {
        console.error('[Shutdown] Error closing server:', err);
        process.exit(1);
      }
      console.log('[Shutdown] All in-flight requests drained cleanly. Exiting.');
      process.exit(0);
    });

    // 2. Give in-flight long-running requests (e.g. streaming, DB transactions) 15 seconds to finish
    const shutdownTimeout = setTimeout(() => {
      console.warn('[Shutdown] Forcing termination: In-flight requests timed out.');
      for (const socket of sockets) {
        socket.destroy();
      }
      process.exit(1);
    }, 15000);

    shutdownTimeout.unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});`,
    breakdown: [
      "Traps SIGTERM sent by Kubernetes pod eviction or autoscaler downscaling.",
      "server.close() halts new incoming connections while allowing active in-flight requests to complete without 502 Bad Gateway errors.",
      "15-second safety timeout guarantees hung database queries or deadlocked sockets won't block deployment rollout indefinitely."
    ],
    expectedOutput: "Zero dropped connections and zero 502/504 errors during Kubernetes rolling upgrades and autoscaling."
  }
];
