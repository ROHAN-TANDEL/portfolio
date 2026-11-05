const { card } = require("../next_builder_helper.cjs");

const cards = [
  card(
    49,
    "Server Actions Fundamentals & RPC Execution Model",
    "Server Actions & Mutations",
    "Mastery",
    "Server Actions are asynchronous server-side functions that can be called directly from Client Components or HTML forms. Behind the scenes, Next.js generates an internal cryptographic POST RPC endpoint, serialized via the React Flight protocol.",
    `// app/actions/todos.ts
"use server"; // Declares Server Actions module

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createTodoAction(title: string) {
  // Executes strictly on Node.js / Edge server!
  if (!title || title.trim().length === 0) {
    throw new Error("Title cannot be empty");
  }

  const todo = await db.todo.create({
    data: { title: title.trim(), completed: false }
  });

  // Revalidates the page cache immediately, updating the UI
  revalidatePath("/todos");
  return todo;
}

// Client Component:
"use client";

import { createTodoAction } from "@/app/actions/todos";

export function TodoCreator() {
  return (
    <button onClick={async () => await createTodoAction("Buy groceries")}>
      Quick Add Todo
    </button>
  );
}`,
    ["Server Actions", "RPC", "POST Endpoint", "revalidatePath", "use server"],
    [
      { title: "Next.js Docs: Server Actions and Mutations", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations" }
    ],
    "How does Next.js handle the network transport when a client invokes a Server Action?",
    "Next.js sends an HTTP POST request to the current URL with an internal `Next-Action` header containing the action ID hash. The server executes the function and returns an updated React Flight stream that reconciles changed Server Components in-place.",
    "Do Server Actions replace API Route Handlers (`app/api/.../route.ts`)?",
    "For internal application mutations and form handling, yes! Server Actions eliminate manual fetch calls, request parsing, and cache invalidation boilerplate. Route Handlers are retained primarily for external webhooks, public REST APIs, and third-party integrations."
  ),

  card(
    50,
    "Invoking Server Actions via Form `action` (Progressive Enhancement)",
    "Server Actions & Mutations",
    "Mastery",
    "When a Server Action is passed to the native HTML `<form action={...}>` prop, Next.js enables Progressive Enhancement: the form works even if JavaScript is disabled or still loading over slow mobile networks.",
    `// app/newsletter/page.tsx (Server Component)
import { db } from "@/lib/db";

async function subscribeNewsletter(formData: FormData) {
  "use server"; // Inline Server Action definition
  const email = formData.get("email") as string;
  await db.newsletter.create({ data: { email } });
}

export default function NewsletterPage() {
  return (
    // Progressive Enhancement:
    // If JS is disabled, browser issues native POST submission.
    // If JS is enabled, Next.js intercepts and submits asynchronously via fetch!
    <form action={subscribeNewsletter} className="flex gap-2 p-6">
      <input
        type="email"
        name="email"
        required
        placeholder="Enter your email"
        className="border p-2 rounded"
      />
      <button type="submit" className="bg-black text-white px-4 py-2 rounded">
        Subscribe
      </button>
    </form>
  );
}`,
    ["Progressive Enhancement", "FormData", "Form Action", "Native Submissions", "Forms"],
    [
      { title: "Next.js Docs: Forms and Server Actions", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#forms" }
    ],
    "What argument is automatically provided to a Server Action when passed to `<form action={...}>`?",
    "The standard web `FormData` instance containing all named inputs (`formData.get('fieldName')`).",
    "Why is Progressive Enhancement critical for high-conversion e-commerce and login workflows?",
    "On slow 3G/4G networks, users often click 'Submit' before large client JavaScript bundles finish downloading and hydrating. Progressive enhancement ensures their submission is not dropped or ignored."
  ),

  card(
    51,
    "Programmatic Server Action Invocations via `startTransition`",
    "Server Actions & Mutations",
    "Mastery",
    "When invoking Server Actions outside of `<form action>`, wrap the call inside React's `useTransition` hook (`startTransition`). This flags the action as a non-blocking background transition, exposing an `isPending` state for UI feedback.",
    `"use client";

import { useTransition } from "react";
import { deletePostAction } from "@/app/actions/posts";

export function DeleteButton({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    // Wrap async Server Action invocation in startTransition
    startTransition(async () => {
      await deletePostAction(postId);
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-red-600 disabled:opacity-50"
    >
      {isPending ? "Deleting post..." : "Delete Post"}
    </button>
  );
}`,
    ["startTransition", "useTransition", "isPending", "Non-blocking UI", "Programmatic Actions"],
    [
      { title: "Next.js Docs: Programmatic Server Action Invocations", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#programmatic-form-submission" }
    ],
    "Why should programmatic Server Action invocations always be wrapped in `startTransition`?",
    "Server Actions trigger a re-render of Server Components. Without `startTransition`, React treats the re-render as an urgent synchronous update, freezing the user interface until the server responds. `startTransition` keeps the UI responsive and provides an `isPending` indicator.",
    "Can `startTransition` handle multiple concurrent action triggers?",
    "Yes. React batches transition updates and tracks `isPending` until all concurrent actions settle."
  ),

  card(
    52,
    "Form State Management with `useActionState` (React 19 / Next 15)",
    "Server Actions & Mutations",
    "Mastery",
    "React 19 and Next.js 15 replace the deprecated `useFormState` hook with `useActionState`. It manages form state, error messages, and pending status, allowing Server Actions to return structured validation errors directly to client forms.",
    `// 1. Server Action returning structured state: app/actions/auth.ts
"use server";

export interface FormState {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export async function loginAction(prevState: FormState, formData: FormData): Promise<FormState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email.includes("@")) {
    return { success: false, errors: { email: "Invalid email address format" } };
  }
  if (password.length < 6) {
    return { success: false, errors: { password: "Password must be at least 6 characters" } };
  }

  // Execute authentication
  return { success: true, message: "Logged in successfully!" };
}

// 2. Client Component consuming state via useActionState:
"use client";

import { useActionState } from "react";
import { loginAction, FormState } from "@/app/actions/auth";

const initialState: FormState = { success: false };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <input name="email" type="email" placeholder="Email" className="border p-2" />
        {state.errors?.email && <p className="text-red-500 text-sm">{state.errors.email}</p>}
      </div>
      <div>
        <input name="password" type="password" placeholder="Password" className="border p-2" />
        {state.errors?.password && <p className="text-red-500 text-sm">{state.errors.password}</p>}
      </div>
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Authenticating..." : "Sign In"}
      </button>
      {state.success && <p className="text-green-600">{state.message}</p>}
    </form>
  );
}`,
    ["useActionState", "React 19", "Form Validation", "isPending", "useFormState Migration"],
    [
      { title: "React Docs: useActionState", url: "https://react.dev/reference/react/useActionState" }
    ],
    "What is the function of the `prevState` argument in a Server Action designed for `useActionState`?",
    "`prevState` contains the previous state returned by the action. It allows Server Actions to maintain state across validation cycles (e.g. preserving form inputs, error arrays, or multi-step wizard progress).",
    "What are the three values returned by the `useActionState` tuple?",
    "`[state, formAction, isPending]` — the current state value, the action dispatcher function to pass to `<form action={...}>`, and a boolean indicating whether the action is actively executing."
  ),

  card(
    53,
    "Pending UI Feedback with `useFormStatus`",
    "Server Actions & Mutations",
    "Mastery",
    "The `useFormStatus` hook provides status information about a parent `<form>` without prop drilling. It must be called from a component rendered inside the `<form>` element, exposing `pending`, `data`, `method`, and `action`.",
    `"use client";

import { useFormStatus } from "react-dom";

// SubmitButton MUST be a child component inside a <form>!
export function SubmitButton({ label = "Save Changes" }: { label?: string }) {
  const { pending, data, method } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 flex items-center gap-2"
    >
      {pending && <span className="animate-spin">⏳</span>}
      {pending ? "Submitting..." : label}
    </button>
  );
}

// Usage in Page:
// <form action={saveProfileAction}>
//   <input name="username" />
//   <SubmitButton /> {/* Cleanly reflects pending state without local state! */}
// </form>`,
    ["useFormStatus", "react-dom", "Loading Spinner", "SubmitButton", "Pending State"],
    [
      { title: "React Docs: useFormStatus", url: "https://react.dev/reference/react-dom/hooks/useFormStatus" }
    ],
    "Why does `useFormStatus()` return `pending: false` if called in the exact same component that defines the `<form>`?",
    "Because `useFormStatus` acts like React Context: it reads status from the parent form. A component cannot read context that it hasn't established yet. The hook must be invoked inside a child component nested within the `<form>` tags.",
    "What information is available in the `data` object returned by `useFormStatus()`?",
    "The in-flight `FormData` instance being submitted, allowing child components to preview submitted values (e.g. displaying an optimistic comment avatar) before the server responds."
  ),

  card(
    54,
    "Real-Time Optimistic UI Updates with `useOptimistic`",
    "Server Actions & Mutations",
    "Mastery",
    "The `useOptimistic` hook updates the UI instantaneously while a Server Action runs in the background. If the server action succeeds, the real server state takes over; if it fails, React automatically rolls back to the previous state.",
    `"use client";

import { useOptimistic } from "react";
import { addCommentAction } from "@/app/actions/comments";

interface Comment {
  id: string;
  text: string;
  sending?: boolean;
}

export function CommentList({ initialComments }: { initialComments: Comment[] }) {
  // useOptimistic returns current optimistic state and a dispatch function
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    initialComments,
    (state, newText: string) => [
      ...state,
      { id: Math.random().toString(), text: newText, sending: true }
    ]
  );

  async function handleFormSubmit(formData: FormData) {
    const text = formData.get("comment") as string;
    // 1. Immediately render in UI!
    addOptimisticComment(text);
    // 2. Execute real background server action
    await addCommentAction(text);
  }

  return (
    <div>
      <ul className="space-y-2">
        {optimisticComments.map(c => (
          <li key={c.id} className={c.sending ? "opacity-50 italic" : ""}>
            {c.text} {c.sending && "(Sending...)"}
          </li>
        ))}
      </ul>
      <form action={handleFormSubmit} className="mt-4 flex gap-2">
        <input name="comment" required placeholder="Write a comment..." className="border p-2" />
        <button type="submit" className="btn-primary">Post</button>
      </form>
    </div>
  );
}`,
    ["useOptimistic", "Optimistic UI", "Instant Feedback", "Rollback", "State Reconciliation"],
    [
      { title: "React Docs: useOptimistic", url: "https://react.dev/reference/react/useOptimistic" }
    ],
    "What happens if the Server Action throws an unhandled error during an optimistic update?",
    "React catches the failure and immediately discards the optimistic state, restoring the UI to the actual server-confirmed state without leaving ghost data.",
    "Why is `useOptimistic` superior to manual `useState` toggling for optimistic updates?",
    "`useOptimistic` integrates with React transitions and Server Components. When the server action completes and revalidates the page, the fresh Server Component payload replaces the optimistic state seamlessly without desynchronization."
  ),

  card(
    55,
    "Server Action Input Validation with Zod & Safe Parsing",
    "Server Actions & Mutations",
    "Mastery",
    "Server Actions are publicly reachable HTTP endpoints. They must never trust incoming parameters. Every Server Action must validate inputs using Zod `safeParse()`, returning structured error messages rather than throwing uncaught exceptions.",
    `// app/actions/register.ts
"use server";

import { z } from "zod";
import { db } from "@/lib/db";

const RegisterSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email("Invalid email format"),
  age: z.coerce.number().min(18, "Must be at least 18 years old")
});

export async function registerUserAction(formData: FormData) {
  // 1. Extract raw entries from FormData
  const rawData = {
    username: formData.get("username"),
    email: formData.get("email"),
    age: formData.get("age")
  };

  // 2. Safe parse with Zod
  const validation = RegisterSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.flatten().fieldErrors
    };
  }

  // 3. Process validated & sanitized data
  const { username, email, age } = validation.data;
  await db.user.create({ data: { username, email, age } });

  return { success: true };
}`,
    ["Zod", "Input Validation", "safeParse", "Sanitization", "Security"],
    [
      { title: "Zod Documentation", url: "https://zod.dev/" }
    ],
    "Why should developers use `safeParse()` instead of `parse()` inside Server Actions?",
    "`parse()` throws a runtime exception when validation fails, triggering an unhandled server error that crashes into the nearest error boundary. `safeParse()` returns a typed `{ success, data, error }` result that can be returned cleanly to client form state.",
    "Why is `z.coerce.number()` needed when parsing form fields with Zod?",
    "HTML form elements submit all values as strings. `z.coerce.number()` automatically casts the string value (e.g. `'25'`) to a number (`25`) before evaluating numerical constraints."
  ),

  card(
    56,
    "Server Action Security: Authentication & Authorization Guards",
    "Security",
    "Mastery",
    "A Server Action can be invoked by anyone using a tool like cURL or Postman. Server Actions must NEVER assume the caller is authenticated; every action must verify the active session and enforce row-level authorization before executing mutations.",
    `// app/actions/documents.ts
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function deleteDocumentAction(documentId: string) {
  // 1. Authentication Guard: Verify active session
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: You must be logged in to delete documents");
  }

  // 2. Authorization Guard: Check row-level ownership in database!
  const document = await db.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true }
  });

  if (!document) {
    throw new Error("Document not found");
  }

  if (document.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    // Prevent IDOR (Insecure Direct Object Reference) exploit!
    throw new Error("Forbidden: You do not have permission to delete this document");
  }

  // 3. Safe to execute mutation
  await db.document.delete({ where: { id: documentId } });
  return { success: true };
}`,
    ["Authorization", "Authentication", "IDOR Defense", "Session Guard", "Security"],
    [
      { title: "Next.js Security: Server Actions", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#security" }
    ],
    "What vulnerability occurs if a Server Action deletes a document by ID without checking the caller's session?",
    "Insecure Direct Object Reference (IDOR). A malicious authenticated user could pass arbitrary IDs (`deleteDocumentAction('doc-8891')`) to delete documents belonging to other users or organizations.",
    "Can middleware alone protect Server Actions from unauthorized access?",
    "No. Middleware can verify whether a session cookie exists, but only the Server Action has the domain context and database access to assert fine-grained record ownership and permission matrices."
  ),

  card(
    57,
    "CSRF Defense & Closure Scope in Server Actions",
    "Security",
    "Deep Dive",
    "Next.js automatically mitigates Cross-Site Request Forgery (CSRF) in Server Actions by validating the `Origin` header against the `Host` header. Furthermore, inline Server Actions automatically bind closure variables via cryptographic encryption.",
    `// Next.js Built-in CSRF Protection:
// When a Server Action is invoked via POST:
// 1. Next.js compares request Origin / Referer header against Host header.
// 2. If Origin does not match Host (Cross-Site invocation) -> Request is rejected with 403 Forbidden!

// Closure Scope Serialization & Encryption:
// app/posts/[id]/page.tsx (Server Component)
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sensitiveSalt = "secret_salt_xyz";

  // Inline Server Action capturing closure variables:
  async function publishPostAction() {
    "use server";
    // Next.js encrypts captured closure variables ('id' and 'sensitiveSalt')
    // into an opaque token signed with the server's build secret!
    await markPublished(id, sensitiveSalt);
  }

  return <form action={publishPostAction}><button>Publish</button></form>;
}`,
    ["CSRF Defense", "Origin Header", "Closure Scope", "Encryption", "Security"],
    [
      { title: "Next.js Security: CSRF Protection", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#security" }
    ],
    "How does Next.js handle closure variables captured by an inline Server Action?",
    "Next.js serializes captured closure variables and encrypts them into an opaque action token using a private server secret. When the client submits the form, the server decrypts the token to restore the bound variables, preventing client-side tampering.",
    "Can you configure custom allowed origins for Server Actions if hosting behind a reverse proxy or separate domain?",
    "Yes. In `next.config.js`, configure `experimental.serverActions.allowedOrigins: ['api.mycompany.com', 'app.mycompany.com']`."
  ),

  card(
    58,
    "Cache Revalidation after Mutation: `revalidatePath` vs `revalidateTag`",
    "Server Actions & Mutations",
    "Mastery",
    "After executing a database mutation in a Server Action, developers invalidate cached data using `revalidatePath()` (invalidates an entire route URL) or `revalidateTag()` (invalidates specific cached fetch requests sharing a semantic tag).",
    `// app/actions/products.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath, revalidateTag } from "next/cache";

export async function updateProductPrice(productId: string, newPrice: number) {
  await db.product.update({
    where: { id: productId },
    data: { price: newPrice }
  });

  // APPROACH A: revalidatePath
  // Invalidates the Full Route Cache for /products and re-renders the page on next request
  revalidatePath("/products");
  revalidatePath("/products/[id]", "page");

  // APPROACH B: revalidateTag (More granular & targeted!)
  // Invalidates ONLY fetch calls tagged with 'product-{id}' or 'catalog'
  // Any page across the entire site that consumed this tag is instantly purged from Data Cache!
  revalidateTag(\`product-\${productId}\`);
  revalidateTag("catalog");
}`,
    ["revalidatePath", "revalidateTag", "Cache Invalidation", "Data Cache", "Full Route Cache"],
    [
      { title: "Next.js Docs: Revalidating Data", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/fetching#revalidating-data" }
    ],
    "Why is `revalidateTag()` generally preferred over `revalidatePath()` in large enterprise applications?",
    "`revalidatePath()` invalidates the entire route tree for a path. `revalidateTag()` targets specific data models: if a product price changes, `revalidateTag('product-123')` purges that item from the home page, product detail page, cart preview, and search results simultaneously without wiping unrelated cached data.",
    "Does `revalidatePath` execute immediately on the server or wait for the next request?",
    "Inside a Server Action, `revalidatePath` purges the server cache immediately, and Next.js sends the freshly rendered Flight stream back in the Server Action response so the client updates in a single roundtrip."
  ),

  card(
    59,
    "Redirecting after Mutation: `redirect()` Behavior",
    "Server Actions & Mutations",
    "Mastery",
    "To navigate a user to a new route after a mutation (e.g. redirecting to the invoice page after checkout), call the `redirect()` function from `next/navigation` inside the Server Action.",
    `// app/actions/onboarding.ts
"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export async function completeOnboardingAction(formData: FormData) {
  const teamName = formData.get("teamName") as string;
  const newTeam = await db.team.create({ data: { name: teamName } });

  // Issue redirect to the new team dashboard
  // CRITICAL: redirect() throws an internal NEXT_REDIRECT exception!
  // NEVER put redirect() inside a try/catch block without re-throwing!
  redirect(\`/teams/\${newTeam.id}/dashboard\`);
}

// GOTCHA: Handling redirect in try/catch:
export async function safeAction(formData: FormData) {
  try {
    await doWork();
    redirect("/success"); // Throws NEXT_REDIRECT error
  } catch (err: any) {
    if (err.message === "NEXT_REDIRECT") throw err; // MUST RE-THROW!
    return { error: "Failed to process" };
  }
}`,
    ["redirect()", "next/navigation", "NEXT_REDIRECT", "Navigation", "Error Handling"],
    [
      { title: "Next.js Docs: redirect", url: "https://nextjs.org/docs/app/api-reference/functions/redirect" }
    ],
    "Why does putting `redirect()` inside a standard `try { ... } catch (e) { ... }` block break navigation in Next.js?",
    "Under the hood, `redirect()` works by throwing a special internal JavaScript exception (`NEXT_REDIRECT`). A generic `catch (e)` block catches this exception and treats it as an application error, swallowing the redirect signal.",
    "What HTTP status code is used when `redirect()` is called in a Server Action versus during static rendering?",
    "In Server Actions, `redirect()` returns an HTTP `303 See Other` to redirect the client via GET. During server-side rendering, it emits an HTTP `307 Temporary Redirect`."
  ),

  card(
    60,
    "Error Handling & Structured Return Results in Server Actions",
    "Server Actions & Mutations",
    "Mastery",
    "Production Server Actions must avoid throwing raw uncaught exceptions, which trigger client Error Boundaries. Instead, use the Result Object Pattern, returning typed `{ success: true, data }` or `{ success: false, error }` structures.",
    `// app/actions/billing.ts
"use server";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function processSubscriptionAction(planId: string): Promise<ActionResult<{ invoiceId: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Please log in to subscribe." }
      };
    }

    const invoice = await paymentGateway.charge(session.user.id, planId);
    return { success: true, data: { invoiceId: invoice.id } };
  } catch (err: any) {
    // Catch unexpected infrastructure failures and return friendly domain error
    console.error("[BillingActionFailure]", err);
    return {
      success: false,
      error: { code: "GATEWAY_ERROR", message: "Payment processor is temporarily unavailable. Please try again." }
    };
  }
}`,
    ["Result Pattern", "Error Handling", "Type Safety", "Domain Errors", "Structured Results"],
    [
      { title: "Next.js Docs: Server Action Error Handling", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#error-handling" }
    ],
    "Why is the Result Object Pattern (`{ success, error }`) superior to throwing exceptions in Server Actions?",
    "Throwing exceptions triggers Next.js Error Boundaries, unmounting the form and replacing the entire UI with an error screen. Returning a Result Object keeps the form mounted, preserves user input, and displays inline error messages cleanly.",
    "How does Next.js protect production error messages when an unhandled exception IS thrown in a Server Action?",
    "In production builds, Next.js masks unhandled error messages, returning a generic message ('An error occurred in the Server Components render') accompanied by a unique `digest` hash for correlation with server logs, preventing stack trace leaks to users."
  )
];

module.exports = { cards };
