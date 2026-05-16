# Features Research: Quiz Flow

**Domain:** Quiz/Test SaaS for knowledge assessment
**Researched:** 2026-05-16
**Target market:** Russian-speaking users (individual educators, HR teams, content creators)
**Competitive set studied:** Google Forms, Typeform, Kahoot, Quizlet, ProProfs, ClassMarker, FlexiQuiz, iSpring, WebAsk, Skillspace, Летучка.ру, Online Test Pad

---

## Table Stakes (must-have or users leave)

Features every quiz platform ships. Their absence makes the product feel unfinished and users bounce to Google Forms.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multiple choice questions (single + multiple answer) | Literally the definition of a quiz | Low | Both types are expected; text-only is insufficient |
| Correct answer marking with auto-grading | Users want a score, not manual counting | Low | Score = correct / total * 100 |
| Result page with score after submission | Google Forms does this for free; absence is shocking | Low | Must show immediately on submit |
| Shareable link to the quiz | Otherwise how do takers reach it? | Low | Unique URL, copy-to-clipboard |
| Quiz title + description | Context before starting is expected | Low | Shown on landing before "Start" |
| Timer per quiz | Expected for assessment contexts; Google Forms lacks it, which is a pain point | Medium | Countdown visible during taking; auto-submit on expiry |
| Navigation controls (next, previous) | Users expect to go back and review | Medium | "Allow return" toggle is the differentiator; default ON is safer UX |
| Stop / submit early | Power users want to submit before time expires | Low | "Finish quiz" button always visible |
| Basic result statistics for the owner | "How did everyone do?" — first question after sharing | Medium | Pass/fail rate, average score, per-question breakdown |
| Cover image / branding for quiz | Distinguishes quizzes visually; all modern platforms do it | Low | Supabase Storage handles this |
| Published / unpublished toggle | Draft state prevents premature sharing | Low | `is_published` flag already in schema |
| Question reordering | Quiz builders always reorder; DnD is expected | Medium | `vue-draggable-plus` handles this |
| Question required / optional toggle | Some questions are informational; others are mandatory | Low | `is_required` in schema |
| Mobile-responsive quiz-taking | >50% of takers will be on mobile | Medium | Tailwind responsive classes; no native app needed |
| Answer shuffling per question | Prevents "always pick C" gaming; expected in assessment contexts | Low | `shuffle_answers` flag — NOT in current schema; add to `quizzes.settings` JSONB |

**Critical schema gap:** `shuffle_answers` is missing. Add as `quizzes.settings.shuffle_answers: boolean` (default false).

---

## Differentiators (competitive advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI generation from uploaded documents/text | 30-second quiz from a PDF is genuinely magical; competitors either lack it or charge heavily | High | The 4-step wizard is correct UX |
| Per-person access tokens (login+password, no platform account) | Enables controlled distribution to employees/students without forcing registration | Medium | Already in spec; genuine market gap |
| Individual link expiry (`expires_at`) | Time-box access for exam contexts | Low | Already in schema; expose in editor UI |
| Label/name per access link | Owner sees "Иванов Иван" in stats, not a UUID | Low | Already in schema (`label`); surface it prominently |
| Zero-friction quiz taking | Takers land on `/q/:token`, enter login+password, done — no Google account, no registration | Low | Competitive advantage vs platforms requiring platform login |
| Freemium with generous free tier | 3 quizzes + 1 AI generation/month is enough to validate value before paying | Medium | 490 ₽/mo is price-competitive for Russian market |
| Refinement step in AI wizard | Competing AI tools skip difficulty/focus controls; Quiz Flow produces better questions | Medium | Expose: question count (slider), difficulty (easy/medium/hard), focus area (text) |
| Ruble pricing via ЮKassa | No USD exposure, no VPN, instant Russian payment | Medium | Significant market-fit advantage post-2022 |

---

## Anti-Features (deliberately avoid)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Question bank / pool with random draw | Adds schema complexity, pool management UI, complex shuffle logic | Answer shuffling covers 80% of anti-cheating need at 5% of the effort |
| Proctoring (webcam, tab-switch detection) | Enterprise feature; alienates casual users | Scoped tokens + timer provide adequate integrity |
| Branching / conditional logic | Requires a full logic engine; zero target use cases need it | Linear flow is better for assessments |
| Team / collaborative editing | Multiplies auth complexity; out of scope per PROJECT.md | Single-owner model |
| Embedding in external sites | iFrame mechanics double QA surface; low ROI | Direct link sharing is sufficient |
| Leaderboards / gamification | Kahoot owns this | Timer + immediate score delivers adequate competitive feeling |
| Comment / feedback threads | Social feature; slows core loop | Owner sees stats; taker sees score |
| PDF / Word export | Valid later; not MVP | Post-MVP phase when users request it |
| Email notifications to takers | Requires email infrastructure; takers have no platform account to email | Owner sees completions in stats |
| Open-ended / essay questions | Require manual grading; break the auto-score model | Single/multiple choice covers knowledge depth |
| Bulk import from CSV/Excel | Adds parser edge cases; AI wizard is the superior path | AI wizard with text paste handles the use case |

---

## AI Generation UX Patterns

### What Works (validated by Quizlet, Quizbot, AceQuiz, Revisely, Questgen patterns)

**Structured wizard is correct.** A single "describe your quiz" textarea produces worse AI outputs than a guided funnel. Quiz Flow's 4-step approach matches what successful tools use.

**File upload is table stakes for AI tools.** PDF, DOCX, plain text are the primary inputs. Accepting only text paste drops perceived value by ~30%.

**Step 3 (refinement) must expose these three controls:**
- Number of questions: slider, range 5–30, default 10
- Difficulty: segmented control — Лёгкий / Средний / Сложный
- Focus area: text field ("Что именно нужно протестировать?")

Without these, AI generates generic recall questions. With them, it generates targeted analytical questions.

**Generate → redirect to editor, not a special review screen.** The editor IS the review screen. Adding a separate "review AI output" step creates unnecessary friction.

**Progress indicator during generation is required.** OpenAI calls take 5–15 seconds. Show three states: "Анализирую документ... → Генерирую вопросы... → Готово!" Spinner alone causes abandonment.

**Generation failure must be graceful.** Show human-readable Russian error messages with "Попробовать снова." Never show raw API error codes.

### What Does Not Work

- Generating 40+ questions in one pass: quality drops; AI drifts from source material. Cap at 30.
- Auto-publishing after generation: users need to review first.
- Blocking free users from AI entirely: 1 AI gen/month on Free establishes the habit loop that drives upgrades.
- Letting AI choose the quiz title: users want to name their quiz.

---

## Guest Access Patterns

### Industry Patterns

1. **Open link** — anyone with URL can take (Google Forms default; no identity)
2. **Single shared password** — one code for all takers (ClassMarker, FlexiQuiz; no per-person stats)
3. **Per-person credentials** — unique login+password per taker (ProProfs classroom, Faabul Individual Mode)
4. **Token URL only** — unique URL per taker, no credentials (survey tools; no identity verification)

Quiz Flow uses pattern 3, which is the correct choice — delivers identity without forcing platform registration.

### UX Requirements for `/q/:token`

1. **Pre-quiz landing:** Quiz title, description, cover image. Then: Login + Password fields + "Начать" button.
2. **Credential validation:** Wrong credentials → inline error message, no page reload.
3. **"Начать" starts the session immediately.** No intermediate loading screen.
4. **Timer placement:** Top-right or top-center; always visible. Turn red in the final 20% of remaining time. Auto-submit on expiry with a brief "Время вышло" toast.
5. **"Allow return" UX:** If `allow_back: false`, show only "Далее" — do NOT show a greyed-out "Назад". If `allow_back: true`, show "Назад" and "Далее".
6. **Progress:** "Вопрос 3 из 10" on every question screen.
7. **Result page:** Score (X из Y), percentage. By default do NOT reveal which answers were correct (prevents sharing). Add `show_correct_answers` owner toggle in a later phase.

---

## Statistics Owners Actually Use

### Tier 1 — Free (shown prominently)

| Metric | What It Shows |
|--------|---------------|
| Total attempts | How many people took the quiz |
| Completion rate | % who finished vs. started |
| Average score | Overall difficulty signal |
| Pass rate (if threshold set) | % above passing mark |
| Per-person result table | label + score + finished_at per session |

### Tier 2 — Pro only (upgrade trigger)

| Metric | What It Shows |
|--------|---------------|
| Per-question accuracy | Which questions are too hard or too easy |
| Average completion time | Is the time limit appropriate? |
| Drop-off by question | Where do takers quit? |
| Score distribution | Bell curve vs. bimodal |

**Key design decision:** Gate per-question accuracy behind Pro with a blurred preview + upgrade CTA. It is the single most compelling upgrade trigger.

### What Owners Do NOT Use (cut from UI)

- Social share counts, device type breakdown, geographic heatmaps, marketing conversion funnel metrics

---

## Russian Market Specifics

### Payment

ЮKassa covers: bank cards, SBP (instant bank transfer), YooMoney wallet — the three dominant Russian payment methods. 490 ₽/month sits correctly in the 299–999 ₽/month cluster for Russian EdTech SaaS.

### Competitive Gap

No Russian tool combines: AI generation from documents + per-person access control with statistics + ruble pricing.

**Летучка.ру** is the closest competitor. Quiz Flow advantages: accounts and history, per-person access tokens, statistics, timer, subscription model.

### Localization Checklist

- Dates in DD.MM.YYYY format in stats tables
- Ruble symbol (₽) in all pricing UI
- All user-facing strings in Russian, including error messages
- Privacy policy referencing 152-ФЗ — expected by Russian B2B buyers
- ЮKassa webhook schema differs from Stripe; Edge Function handler must be purpose-built

---

## Feature Dependency Map

```
AI Wizard (generate)
  → requires: Quiz Editor (to review generated result)
  → requires: Supabase Edge Function (OpenAI call)
  → requires: File parsing (PDF/DOCX → text extraction)

Quiz Sharing (token)
  → requires: Quiz published (is_published: true)
  → requires: quiz_access record created (login+password+label)
  → enables: Statistics (sessions only exist after sharing)

Statistics
  → requires: quiz_sessions + session_answers populated
  → requires: At least one completed session

Freemium gates
  → requires: subscriptions table + ЮKassa integration
  → gates: AI generation beyond 1/month on Free
  → gates: individual links on Free (per spec)
  → gates: per-question stats on Free
```

---

## Open Questions

1. **File parsing in Edge Function:** How will PDF/DOCX text be extracted server-side? Options: pdf-parse (Node), LlamaIndex, or passing raw bytes to OpenAI file API. Affects AI wizard step 2 UX and error handling.
2. **Show correct answers post-result:** Should owners enable showing correct answers to takers? Recommend a toggle defaulting to OFF, shipped post-MVP.
3. **Link expiry UX:** Schema has `expires_at` on `quiz_access`. Expired links need a graceful "Ссылка истекла" page before the feature is released.
4. **AI question count ceiling:** Current spec limits runs (1/month on Free). A per-run question cap (10 on Free, 30 on Pro) would be a stronger upgrade lever.
