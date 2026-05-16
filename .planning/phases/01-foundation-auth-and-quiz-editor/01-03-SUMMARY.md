---
plan: 01-03
phase: 01-foundation-auth-and-quiz-editor
status: complete
completed: 2026-05-17
requirements: [QUIZ-01, QUIZ-02, QUIZ-03, QUIZ-07, EDIT-08, NAV-01, NAV-02]
commits:
  - 513e40b feat(01-03): useQuizEditorStore with debounced save, publish gate, cover upload
  - 2ffc04e feat(01-03): editor shell — 100dvh layout, metadata, cover, publish, nav settings
  - d4f3953 feat(01-03): storage RLS policies for the covers bucket
  - 58ed339 fix(01): import vue-sonner stylesheet so toasts render styled
  - e312328 style(01): unify page width to 1280px and add AppHeader to the editor page
  - 23006d9 style(01): compact 6-up quiz cards, restore button pointer cursor
---

# Phase 1 Plan 03: Quiz Editor Shell Summary

**One-liner:** `useQuizEditorStore` (debounced auto-save, publish gate, cover upload) + the `calc(100dvh - header)` editor shell with metadata header, cover upload, publish toggle, and navigation-settings footer.

## Status: COMPLETE

## Artifacts

- `src/4-features/quiz-editor/model/useQuizEditorStore.ts` — quiz/title/description/timeLimit/settings state; debounced metadata save (500ms); `updateSettings` (immediate); `publishToggle` (publish-time validation); `uploadCover`/`removeCover`; +4 unit tests
- `src/5-entities/question/{model,api}.ts` — Question entity + `fetchQuestions` (created here; the plan assumed it existed — Plan 04 extends api.ts)
- `src/3-widgets/QuizEditorWidget.vue` — `calc(100dvh - 3.5rem)` grid shell (header / scroll body / footer)
- `src/3-widgets/QuizEditorHeader.vue` — back arrow, inline title, publish toggle, metadata + cover row
- `src/3-widgets/QuizEditorFooter.vue` — navigation settings panel
- `src/4-features/quiz-editor/ui/QuizMetaForm.vue` — description + time-limit (minutes ↔ seconds)
- `src/4-features/quiz-editor/ui/CoverUpload.vue` — click + drag-drop, delegates to `store.uploadCover` (no `storage.from`)
- `src/4-features/quiz-editor/ui/PublishToggle.vue` — Switch wired to `publishToggle`
- `src/4-features/quiz-editor/ui/NavigationSettings.vue` — allow_back + show_stop_button toggles
- `supabase/migrations/008_storage_covers_policies.sql` — covers-bucket INSERT/UPDATE/DELETE RLS

## Verified (live, against real Supabase)

- ✅ Title / description / time-limit auto-save and persist across reload
- ✅ Cover upload works (after applying migration 008 storage policies)
- ✅ Publish blocked with no questions (validation working as designed)
- ✅ Navigation toggles persist
- ✅ Toasts render top-right (after vue-sonner CSS fix)

## Deviations / Incidents

- **Question entity created here** — plan assumed `fetchQuestions` already existed; it did not. Added `src/5-entities/question/` (model + `fetchQuestions`). Plan 04 extends `api.ts` with full CRUD.
- **vue-sonner CSS missing** — `vue-sonner/style.css` was never imported, so toasts rendered as unstyled text at the bottom of the page. Fixed in `main.ts`.
- **Storage policies were comment-only** — migration 007 documented the covers-bucket policy in a comment but never created it; cover upload failed with a generic error. Added migration 008 with real `CREATE POLICY` statements; user applied them via SQL Editor.
- **UI design-review round** — user requested: unified 1280px page width (`max-w-7xl`), AppHeader on the editor page, compact 6-up quiz cards, and `cursor-pointer` on buttons (Tailwind v4 dropped the button-cursor default). All applied.

## Interfaces for Plan 04

```
useQuizEditorStore: quiz, questions (empty — Plan 04 populates), title, description,
  timeLimit, settings, isLoading, isUploadingCover,
  loadQuiz, updateSettings, publishToggle, uploadCover, removeCover
Question entity: src/5-entities/question/{model,api}.ts — Plan 04 adds
  createQuestion/updateQuestion/deleteQuestion/reorderQuestions to api.ts
QuizEditorWidget body currently shows a placeholder — Plan 04 mounts QuestionList there.
validateForPublish in the store checks only questions.length — Plan 04 adds
  per-question answer-option checks.
```
