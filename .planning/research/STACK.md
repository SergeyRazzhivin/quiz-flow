# Stack Research: Quiz Flow

**Project:** Quiz Flow — Quiz/Test SaaS with AI generation
**Researched:** 2026-05-16
**Stack:** Fixed (Vite + Vue 3 + TypeScript + Tailwind CSS v4 + Pinia + Vue Router 4 + Supabase + OpenAI + ЮKassa)

---

## Vue 3 Ecosystem

### Drag-and-Drop: vue-draggable-plus

**Use:** `vue-draggable-plus@^0.6.1`
**Install:** `npm install vue-draggable-plus`

Correct choice. Original `vuedraggable` is Vue 2 only. `vue.draggable.next` is unmaintained (no npm v4 release since 2021). `vue-draggable-plus` actively wraps SortableJS, supports Vue 3 + TypeScript natively.

Use **component mode** for quiz question lists:

```typescript
// 4-features/quiz-editor/ui/QuestionList.vue
import { VueDraggable } from 'vue-draggable-plus'
```

```html
<VueDraggable v-model="questions" handle=".drag-handle" @end="onEnd">
  <QuestionCard v-for="q in questions" :key="q.id" :question="q" />
</VueDraggable>
```

Do NOT use: `vue.draggable.next` (unmaintained), raw SortableJS without wrapper (breaks Vue reactivity).

---

### Form Validation: vee-validate + zod

**Use:** `vee-validate@^4.15.1` + `@vee-validate/zod@^4.15.1` + `zod@^3.23.x`

Canonical pattern:

```typescript
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'

const schema = toTypedSchema(z.object({
  title: z.string().min(3).max(120),
  time_limit_sec: z.number().int().positive().nullable(),
  allow_back: z.boolean(),
}))

const { defineField, handleSubmit, errors } = useForm({ validationSchema: schema })
const [title, titleAttrs] = defineField('title')
```

Do NOT use: `vuelidate`, raw HTML5 `required`, `Field` component (deprecated in vee-validate v4).

---

### Supabase JS Client

**Version:** `@supabase/supabase-js@^2.x`
**FSD placement:** `6-shared/api/supabase.ts` — singleton exported; all slices import from here.

Generate TypeScript types after every migration:
```
npx supabase gen types typescript --local > src/6-shared/types/database.types.ts
```

---

## Supabase Patterns

### Auth: Owner Registration/Login

Standard Supabase Auth (email + password). Guard owner routes with Vue Router navigation guard checking `supabase.auth.getSession()`. Sync session state via `supabase.auth.onAuthStateChange` into a Pinia store.

### Auth: Test-Takers (Token-Based Guest Access)

Test-takers do NOT use Supabase Auth. Flow:

1. Client posts `{ token, login, password }` to Edge Function `verify-quiz-access`.
2. Edge Function validates against `quiz_access` table using **service role key**.
3. Edge Function returns a short-lived custom JWT containing `{ quiz_access_id, quiz_id, role: 'anon' }`.
4. Client stores JWT in `sessionStorage` and uses it for subsequent EF calls.

Critical: never pass service role key to the client. All credential validation happens in Edge Functions only.

### RLS Design Summary

- Owner tables: `auth.uid() = owner_id`
- Guest session tables: mediated via Edge Function with service_role (no direct PostgREST writes)
- `quiz_access` table: no direct client access — Edge Function only
- Storage: public read; write restricted via `auth.uid() = owner_id`

### Supabase Edge Functions

Runtime is Deno (TypeScript). Use `npm:` specifier (recommended over `deno.land/x/`):

```typescript
import OpenAI from 'npm:openai'
```

Pin versions in `deno.json`:
```json
{ "imports": { "openai": "npm:openai@^4.68.0" } }
```

Secrets: `supabase secrets set OPENAI_API_KEY=sk-...`, accessed as `Deno.env.get('OPENAI_API_KEY')`.

---

## AI Integration (OpenAI via Edge Functions)

### Model: `gpt-4o-mini` (not `gpt-4o`)

Quiz generation is structured extraction, not reasoning. `gpt-4o-mini` achieves 100% schema adherence with Structured Outputs and costs ~15x less. Upgrade to `gpt-4o` only if quality is insufficient.

### Use Batch Mode (stream: false)

Quiz generation returns a complete JSON document. Streaming partial JSON is not parseable incrementally.

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userText },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'quiz_questions', strict: true, schema: QUIZ_JSON_SCHEMA },
  },
  stream: false,
})

// Always check refusal before parsing
if (response.choices[0].message.refusal) {
  throw new Error(`OpenAI refused: ${response.choices[0].message.refusal}`)
}
const questions = JSON.parse(response.choices[0].message.content!)
```

### JSON Schema Requirements for strict: true

Every object must have `additionalProperties: false` AND all fields listed in `required`. Missing either causes the API to reject the schema.

### Input Budget

Cap source text at 12,000 characters (~3,000 tokens). Warn user in UI if truncation occurs.

---

## Payment Integration (ЮKassa)

### Do NOT use a third-party SDK

Official ЮKassa SDK is not Deno-compatible. Community TS SDKs have low maintenance. Use raw `fetch` with Basic Auth — the API is simple and fully documented.

### Webhook Architecture

```
Client → ЮKassa payment page (redirect)
ЮKassa → POST /functions/v1/yookassa-webhook
Edge Function → verify IP → re-fetch payment → UPDATE subscriptions (service role)
```

### Key Webhook Events

| Event | Action |
|-------|--------|
| `payment.succeeded` | Set subscription active, store `payment_method_id` |
| `payment.canceled` | Log failure |
| `refund.succeeded` | Downgrade to Free |
| `payment_method.active` | Confirm recurrent method binding |

### Verification

ЮKassa uses **IP allowlist verification** (not HMAC). Validate against IP ranges: `185.71.76.0/27`, `185.71.77.0/27`, `77.75.153.0/25`, `77.75.156.11`, `77.75.156.35`, `77.75.154.128/25`, `2a02:5180::/32`. Re-fetch payment from ЮKassa API to confirm status — do not trust webhook payload status alone.

Respond HTTP 200 immediately. ЮKassa retries for 24 hours on any other code.

### Payment Creation (idempotence key is mandatory)

```typescript
const payment = await fetch('https://api.yookassa.ru/v3/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${btoa(`${shopId}:${secretKey}`)}`,
    'Idempotence-Key': crypto.randomUUID(),
  },
  body: JSON.stringify({
    amount: { value: '490.00', currency: 'RUB' },
    confirmation: { type: 'redirect', return_url: `${origin}/billing?payment=success` },
    capture: true,
    save_payment_method: true,
    description: 'Quiz Flow Pro подписка',
    metadata: { user_id: userId },
  }),
})
```

---

## Development Tooling

### Testing

`vitest@^3.x` + `@vue/test-utils@^2.x` + `@pinia/testing`
Environment: `happy-dom` (faster than jsdom)

```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [vue()],
  test: { environment: 'happy-dom', globals: true },
})
```

Pinia in tests: `createTestingPinia({ createSpy: vi.fn })` — stubs all actions automatically.

### Linting and FSD Enforcement

`eslint@^9.x` (flat config) + `@vue/eslint-config-typescript` + `steiger`

`steiger` is the official FSD linter — checks layer hierarchy, prevents sibling slice imports, enforces public API via `index.ts`. Run in CI. Verify it handles numbered prefixes (`1-app`, `2-pages`, etc.).

### Tailwind CSS v4 Setup

**Breaking changes from v3:**
- `tailwind.config.js` is gone
- `darkMode: 'class'` config is deprecated
- `@tailwind base/components/utilities` directives are removed

**New setup:**

```
npm install tailwindcss @tailwindcss/vite
```

`vite.config.ts`: add `tailwindcss()` to plugins (no PostCSS needed).

`main.css`:
```css
@import "tailwindcss";

@theme {
  --font-sans: 'Inter', sans-serif;
}

/* Class-based dark mode — v4 syntax */
@custom-variant dark (&:where(.dark, .dark *));
```

Toggle dark mode by setting/removing `.dark` class on `<html>`, managed in a Pinia store persisted to `localStorage`.

### TypeScript Path Aliases (required for FSD)

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@app/*": ["src/1-app/*"],
      "@pages/*": ["src/2-pages/*"],
      "@widgets/*": ["src/3-widgets/*"],
      "@features/*": ["src/4-features/*"],
      "@entities/*": ["src/5-entities/*"],
      "@shared/*": ["src/6-shared/*"]
    }
  }
}
```

Mirror in `vite.config.ts` under `resolve.alias`.

---

## FSD-Compatible Library Organization

Libraries live in `6-shared/lib/` as thin re-export wrappers. Feature/entity slices never import library internals directly.

```
6-shared/
  api/
    supabase.ts          — singleton client
    database.types.ts    — generated types
    edge.ts              — typed EF invocation wrappers
  lib/
    vee-validate.ts      — re-exports useForm, defineField
    draggable.ts         — re-exports VueDraggable
    format.ts            — date, duration formatters
    timer.ts             — useCountdown composable (interval math only)
  model/
    useThemeStore.ts
  ui/
    Button.vue, Input.vue, Modal.vue, Toggle.vue
    GradientButton.vue   — violet→indigo CTA
  config/
    env.ts               — typed VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

---

## Confidence Levels

| Area | Confidence | Notes |
|------|------------|-------|
| vue-draggable-plus v0.6.1 | HIGH | Confirmed on npm registry |
| vee-validate + zod pattern | HIGH | Official docs, `defineField` is canonical |
| Supabase JS v2 | HIGH | Stable, v3 not released |
| Custom JWT guest access via EF | MEDIUM | Documented pattern; needs local testing |
| Edge Functions `npm:` specifier | MEDIUM | Announced as recommended; verify `deno.json` pinning |
| OpenAI Structured Outputs strict mode | HIGH | Official docs, production-ready |
| gpt-4o-mini for generation | HIGH | Correct for structured extraction |
| Batch over streaming for quiz JSON | HIGH | Architectural reasoning + API docs |
| ЮKassa IP allowlist (not HMAC) | HIGH | Official ЮKassa developer docs |
| ЮKassa raw fetch over SDK | MEDIUM | Community SDKs low-maintenance; raw fetch safer |
| Tailwind v4 `@custom-variant dark` | HIGH | Confirmed breaking change |
| steiger for FSD enforcement | MEDIUM | Verify numbered prefix support |

---

## Breaking Changes to Watch

| Library | Change | Impact |
|---------|--------|--------|
| Tailwind CSS v4 | No `tailwind.config.js`; `darkMode: 'class'` deprecated | Use `@custom-variant dark` in CSS |
| Tailwind CSS v4 | `@tailwind` directives removed | Use `@import "tailwindcss"` |
| vee-validate v4 | `Field` component approach deprecated | Use `defineField` composable only |
| OpenAI Structured Outputs | New `refusal` field | Check `message.refusal` before `JSON.parse` |
| Supabase Edge Functions | `deno.land/x/` superseded by `npm:` | Prefer `npm:openai` |
