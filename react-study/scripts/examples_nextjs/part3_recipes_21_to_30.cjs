const recipes = [
  {
    id: "next-ex-21",
    title: "Server Action with Zod Validation & Typed Form State",
    category: "Server Actions & Mutations",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production Server Action parsing incoming FormData with Zod safeParse, enforcing constraints, and returning typed validation errors to client forms.",
    conceptsCovered: ["Server Actions", "Zod", "safeParse", "FormData", "Typed State"],
    code: `// app/actions/signup.ts
"use server";

import { z } from "zod";
import { db } from "@/lib/db";

const SignupSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export type SignupResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function signupAction(prevState: SignupResult, formData: FormData): Promise<SignupResult> {
  const rawData = Object.fromEntries(formData.entries());

  // 1. Validate with Zod
  const validation = SignupSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      fieldErrors: validation.error.flatten().fieldErrors
    };
  }

  // 2. Business Logic
  const { email, password } = validation.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, fieldErrors: { email: ["Email already in use"] } };
  }

  await db.user.create({ data: { email, passwordHash: await hashPassword(password) } });
  return { success: true, message: "Account created successfully!" };
}`,
    breakdown: [
      "Validates all inputs with Zod safeParse before executing mutations.",
      "Handles custom cross-field refinements (password matching).",
      "Returns structured fieldErrors without throwing unhandled exceptions.",
      "Compatible with React 19's useActionState hook."
    ],
    expectedOutput: "Returns typed validation errors on bad input; creates user on valid input."
  },

  {
    id: "next-ex-22",
    title: "Form State Management using `useActionState` (React 19)",
    category: "Server Actions & Mutations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Consuming a Server Action with useActionState in Next.js 15, handling form submission, pending states, and displaying inline validation errors.",
    conceptsCovered: ["useActionState", "React 19", "Form State", "Inline Errors", "Next.js 15"],
    code: `// components/SignupForm.tsx
"use client";

import { useActionState } from "react";
import { signupAction, SignupResult } from "@/app/actions/signup";

const initialState: SignupResult = { success: false };

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState);

  return (
    <form action={formAction} className="max-w-md mx-auto space-y-4 p-6 border rounded-xl bg-white shadow">
      <h2 className="text-xl font-bold">Create Account</h2>

      <div>
        <label className="block text-sm font-medium">Email Address</label>
        <input name="email" type="email" required className="w-full border p-2 rounded mt-1" />
        {state.fieldErrors?.email && (
          <p className="text-red-500 text-xs mt-1">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Password</label>
        <input name="password" type="password" required className="w-full border p-2 rounded mt-1" />
        {state.fieldErrors?.password && (
          <p className="text-red-500 text-xs mt-1">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Confirm Password</label>
        <input name="confirmPassword" type="password" required className="w-full border p-2 rounded mt-1" />
        {state.fieldErrors?.confirmPassword && (
          <p className="text-red-500 text-xs mt-1">{state.fieldErrors.confirmPassword[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-black text-white p-2 rounded font-medium disabled:opacity-50"
      >
        {isPending ? "Creating Account..." : "Sign Up"}
      </button>

      {state.success && (
        <p className="text-green-600 text-sm font-semibold text-center">{state.message}</p>
      )}
    </form>
  );
}`,
    breakdown: [
      "Binds Server Action to form state using React 19's useActionState.",
      "Automatically receives isPending boolean for loading spinner state.",
      "Renders server-side validation error messages beside the relevant inputs.",
      "Provides clean declarative state management without useEffect."
    ],
    expectedOutput: "Renders form, disables button on submission, and shows inline error messages."
  },

  {
    id: "next-ex-23",
    title: "Instant Feedback Button with `useFormStatus`",
    category: "Server Actions & Mutations",
    difficulty: "beginner",
    whatThisCodeCovers: "A standalone SubmitButton component using useFormStatus from react-dom to automatically disable inputs and display a spinner while parent form action executes.",
    conceptsCovered: ["useFormStatus", "react-dom", "SubmitButton", "Pending Indicator", "Decoupling"],
    code: `// components/SubmitButton.tsx
"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children = "Submit",
  loadingText = "Saving..."
}: {
  children?: React.ReactNode;
  loadingText?: string;
}) {
  // Reads pending state from parent <form> context automatically!
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-slate-900 text-white rounded font-medium disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {pending ? (
        <>
          <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}`,
    breakdown: [
      "Uses useFormStatus from react-dom to eliminate manual pending prop drilling.",
      "Must be nested inside a parent <form action={...}> component.",
      "Disables the button automatically to prevent accidental double-submits.",
      "Renders accessible spinning SVG loader during active server requests."
    ],
    expectedOutput: "Button disables and displays spinner during server action processing."
  },

  {
    id: "next-ex-24",
    title: "Real-Time Optimistic Likes Counter with `useOptimistic`",
    category: "Server Actions & Mutations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implementing an instant-response like button with useOptimistic, updating the count in 0ms while the Server Action persists to PostgreSQL in the background.",
    conceptsCovered: ["useOptimistic", "Optimistic UI", "Instant Response", "Automated Rollback", "Server Actions"],
    code: `// components/OptimisticLikeButton.tsx
"use client";

import { useOptimistic, startTransition } from "react";
import { toggleLikeAction } from "@/app/actions/likes";

export function OptimisticLikeButton({
  postId,
  initialLikes,
  initialHasLiked
}: {
  postId: string;
  initialLikes: number;
  initialHasLiked: boolean;
}) {
  // useOptimistic manages current confirmed state and optimistic overrides
  const [state, setOptimisticState] = useOptimistic(
    { likes: initialLikes, hasLiked: initialHasLiked },
    (current, update: "toggle") => ({
      likes: current.hasLiked ? current.likes - 1 : current.likes + 1,
      hasLiked: !current.hasLiked
    })
  );

  const handleLike = () => {
    // 1. Immediately flip UI state in browser!
    startTransition(async () => {
      setOptimisticState("toggle");
      try {
        // 2. Execute background server action
        await toggleLikeAction(postId);
      } catch (err) {
        console.error("Like failed on server! React rolls back optimistic state automatically.", err);
      }
    });
  };

  return (
    <button
      onClick={handleLike}
      className={\`px-4 py-2 rounded-full border flex items-center gap-2 font-bold \${
        state.hasLiked ? "bg-red-50 border-red-200 text-red-600" : "bg-white text-slate-700"
      }\`}
    >
      <span>{state.hasLiked ? "❤️" : "🤍"}</span>
      <span>{state.likes}</span>
    </button>
  );
}`,
    breakdown: [
      "Updates likes counter and heart icon in 0 milliseconds.",
      "Executes server mutation asynchronously in the background.",
      "Automatically rolls back optimistic state if the server action throws an error.",
      "Eliminates latency for real-time engagement buttons."
    ],
    expectedOutput: "Clicking heart updates count instantaneously without waiting for network response."
  },

  {
    id: "next-ex-25",
    title: "Server Action Progressive Enhancement Fallback",
    category: "Server Actions & Mutations",
    difficulty: "beginner",
    whatThisCodeCovers: "A form with Server Action that works 100% with JavaScript disabled using standard HTML POST, upgrading to smooth async fetch when JavaScript hydrates.",
    conceptsCovered: ["Progressive Enhancement", "HTML Forms", "No-JS Fallback", "Native POST", "Next.js Actions"],
    code: `// app/feedback/page.tsx (Server Component)
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function submitFeedback(formData: FormData) {
  "use server";
  const comment = formData.get("comment") as string;
  if (!comment) return;

  await db.feedback.create({ data: { comment } });
  revalidatePath("/feedback");
}

export default function FeedbackPage() {
  return (
    <div className="p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Customer Feedback</h1>
      
      {/* Works without JavaScript: Browser submits native HTTP POST!
          Works with JavaScript: Next.js intercepts and handles as async fetch! */}
      <form action={submitFeedback} className="space-y-4">
        <textarea
          name="comment"
          required
          placeholder="Share your thoughts..."
          className="w-full border p-3 rounded"
          rows={4}
        />
        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded font-bold">
          Send Feedback
        </button>
      </form>
    </div>
  );
}`,
    breakdown: [
      "Demonstrates progressive enhancement: works seamlessly with JavaScript disabled.",
      "Native HTML form attributes (required, rows) provide baseline validation.",
      "Automatically transitions to single-page client fetch once JavaScript loads.",
      "Guarantees form submissions succeed even on flaky connections."
    ],
    expectedOutput: "Form submits successfully whether client-side JavaScript is active or disabled."
  },

  {
    id: "next-ex-26",
    title: "Server Action Row-Level Authorization & IDOR Defense",
    category: "Security & Data Mutations",
    difficulty: "advanced",
    whatThisCodeCovers: "Securing a Server Action against Insecure Direct Object References (IDOR) by validating session credentials and asserting row-level tenant ownership in PostgreSQL.",
    conceptsCovered: ["IDOR Defense", "Row-Level Security", "Authentication Guard", "Authorization", "Session Verification"],
    code: `// app/actions/invoices.ts
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function voidInvoiceAction(invoiceId: string) {
  // 1. Authentication Check: Ensure user is logged in
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("HTTP 401: Unauthorized");
  }

  // 2. Fetch invoice and verify organization ownership (IDOR Defense)
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, orgId: true, status: true }
  });

  if (!invoice) {
    throw new Error("HTTP 404: Invoice not found");
  }

  // Check if active user belongs to the invoice's organization
  if (invoice.orgId !== session.user.orgId && session.user.role !== "SUPER_ADMIN") {
    // Attack detected: user is attempting to void another company's invoice!
    throw new Error("HTTP 403: Forbidden: You do not own this invoice resource");
  }

  // 3. Safe to mutate
  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: "VOIDED", voidedAt: new Date() }
  });

  return { success: true };
}`,
    breakdown: [
      "Never trusts parameters passed from the client directly.",
      "Verifies active user session from cryptographic cookies on the server.",
      "Queries database to verify that the entity's orgId matches the session orgId.",
      "Blocks malicious users from forging IDs to alter competitors' data."
    ],
    expectedOutput: "Voids invoice if authorized; throws 403 Forbidden on IDOR tampering attempts."
  },

  {
    id: "next-ex-27",
    title: "Handling File Uploads in Server Actions with FormData",
    category: "Server Actions & Mutations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Handling file uploads (PDF/Images) directly inside a Server Action, validating file size and MIME types, and streaming to AWS S3 / Cloudflare R2.",
    conceptsCovered: ["File Upload", "FormData", "Buffer", "MIME Validation", "AWS S3 Streaming"],
    code: `// app/actions/upload.ts
"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "node:crypto";

const s3 = new S3Client({ region: "us-east-1" });

export async function uploadAvatarAction(formData: FormData) {
  const file = formData.get("avatar") as File | null;

  if (!file || file.size === 0) {
    return { success: false, error: "No file provided" };
  }

  // 1. File Size Guard (Max 4MB)
  if (file.size > 4 * 1024 * 1024) {
    return { success: false, error: "File exceeds 4MB limit" };
  }

  // 2. MIME Type Whitelist Guard
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimeTypes.includes(file.type)) {
    return { success: false, error: "Only JPEG, PNG, and WebP images are allowed" };
  }

  // 3. Convert File to Buffer and upload to S3
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileKey = \`avatars/\${crypto.randomUUID()}-\${file.name}\`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: fileKey,
    Body: buffer,
    ContentType: file.type
  }));

  const publicUrl = \`https://cdn.mycompany.com/\${fileKey}\`;
  return { success: true, url: publicUrl };
}`,
    breakdown: [
      "Extracts native File object from submitted FormData.",
      "Validates file byte size against 4MB ceiling before reading into memory.",
      "Restricts MIME types to safe image formats.",
      "Uploads buffer directly to AWS S3 with clean randomized file key."
    ],
    expectedOutput: "Validates and uploads file to S3; returns public CDN image URL."
  },

  {
    id: "next-ex-28",
    title: "Dynamic Revalidation after Mutation via `revalidatePath`",
    category: "Server Actions & Mutations",
    difficulty: "beginner",
    whatThisCodeCovers: "Using revalidatePath inside a Server Action to clear the Full Route Cache for a modified route, prompting the client to update instantly.",
    conceptsCovered: ["revalidatePath", "Cache Purge", "Client Reconciliation", "Server Actions", "Full Route Cache"],
    code: `// app/actions/posts.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function publishPost(postId: string) {
  await db.post.update({
    where: { id: postId },
    data: { published: true }
  });

  // Revalidate specific post page:
  revalidatePath(\`/posts/\${postId}\`);

  // Revalidate posts index list:
  revalidatePath("/posts");

  // Revalidate entire dashboard layout:
  revalidatePath("/dashboard", "layout");
}`,
    breakdown: [
      "Invalidates the server-side Full Route Cache for multiple paths simultaneously.",
      "Sends fresh Flight stream payload back to the client in the Server Action response.",
      "The client UI updates in the same roundtrip without a page reload.",
      "Supports specific leaf pages or entire layout trees."
    ],
    expectedOutput: "Publishes post and purges route caches; fresh post displays immediately."
  },

  {
    id: "next-ex-29",
    title: "Targeted Semantic Invalidation via `revalidateTag`",
    category: "Server Actions & Mutations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Using revalidateTag to selectively purge cached fetch data across all pages that consume a specific semantic tag without wiping unrelated routes.",
    conceptsCovered: ["revalidateTag", "Cache Tags", "Surgical Invalidation", "Data Cache", "Granular Invalidation"],
    code: `// 1. Fetching with semantic cache tags: app/catalog/page.tsx
export default async function CatalogPage() {
  const res = await fetch("https://api.store.com/inventory", {
    next: { tags: ["catalog-items"] } // Tagged fetch call!
  });
  const items = await res.json();
  return <ItemGrid items={items} />;
}

// 2. Server Action updating stock: app/actions/inventory.ts
"use server";

import { revalidateTag } from "next/cache";

export async function restockItemAction(sku: string, addedQty: number) {
  await callBackendInventoryApi(sku, addedQty);

  // Surgically purge ONLY the data cache entries tagged with 'catalog-items'!
  // Any page on the site displaying catalog items will fetch fresh data on next request.
  revalidateTag("catalog-items");
}`,
    breakdown: [
      "Tags data fetch calls with domain identifiers ('catalog-items').",
      "Server Action purges all cached fetch responses sharing that tag.",
      "Unrelated cached pages and APIs remain warm and unaffected.",
      "Ideal for e-commerce catalog updates and CMS content publishing."
    ],
    expectedOutput: "Calling restockItemAction purges Data Cache for 'catalog-items' globally."
  },

  {
    id: "next-ex-30",
    title: "Post-Mutation Redirection with `redirect()` Handling",
    category: "Server Actions & Mutations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Redirecting a user after successful Server Action completion while handling the internal NEXT_REDIRECT exception safely inside try/catch blocks.",
    conceptsCovered: ["redirect()", "NEXT_REDIRECT", "try/catch", "HTTP 303", "Navigation Flow"],
    code: `// app/actions/createProject.ts
"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export async function createProjectAction(prevState: any, formData: FormData) {
  let newProjectId: string | null = null;

  try {
    const name = formData.get("name") as string;
    if (!name) return { error: "Name is required" };

    const project = await db.project.create({ data: { name } });
    newProjectId = project.id;
  } catch (err: any) {
    console.error("Database write failed:", err);
    return { error: "Failed to create project" };
  }

  // CRITICAL: Call redirect() OUTSIDE the try/catch block!
  // redirect() throws an internal NEXT_REDIRECT error. Calling it inside try/catch
  // causes the catch block to intercept the redirect and swallow it!
  if (newProjectId) {
    redirect(\`/projects/\${newProjectId}\`);
  }
}`,
    breakdown: [
      "Demonstrates proper redirect() placement outside try/catch blocks.",
      "Prevents catching the internal NEXT_REDIRECT exception as an error.",
      "Returns HTTP 303 See Other, instructing the browser to execute client navigation.",
      "Safely navigates the user to the newly created project dashboard."
    ],
    expectedOutput: "Creates project in DB and smoothly redirects browser to /projects/new-id."
  }
];

module.exports = { recipes };
