---
plan: 01-04
phase: 01-foundation-auth-and-quiz-editor
status: complete
completed: 2026-05-17
requirements: [EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, QUIZ-03]
commits:
  - ad919f4 feat(01-04): question + answer-option entities, editor store CRUD & reorder
  - d6a3f41 feat(01-04): question editor UI — QuestionEditor, AnswerOptionEditor, DnD list
  - e34275f fix(01-04): drop extra correct answers when switching a question to single
---

# Phase 1 Plan 04: Question Editor Summary

**One-liner:** Question + answer-option entity layers, editor store extended with question/option CRUD and DnD reorder, and the QuestionEditor / AnswerOptionEditor / QuestionList UI — the full editorial surface.

## Status: COMPLETE — verified end-to-end

## Artifacts

- `src/5-entities/question/api.ts` — `fetchQuestions`, `createQuestion`, `updateQuestion`, `deleteQuestion`, `reorderQuestions` (full-row batch upsert)
- `src/5-entities/answer-option/{model,api}.ts` — `fetchAnswerOptions`, `createAnswerOption`, `updateAnswerOption`, `deleteAnswerOption`
- `src/4-features/quiz-editor/model/useQuizEditorStore.ts` — extended: `questions`, `answerOptions`, `addQuestion`, `updateQuestion`, `deleteQuestion` (renumber), `reorderQuestions`, `addAnswerOption`, `updateAnswerOption` (single-answer reconciliation), `deleteAnswerOption`, full `validateForPublish`
- `src/4-features/quiz-editor/model/questionReorder.test.ts` — reorder/delete-renumber/publish-validation tests
- `src/4-features/quiz-editor/ui/QuestionEditor.vue` — always-expanded question card; type toggle, required switch, delete dialog, auto-resize textarea
- `src/4-features/quiz-editor/ui/AnswerOptionEditor.vue` — radio (single) / checkbox (multiple) correct indicator, inline body, immediate delete
- `src/3-widgets/QuestionList.vue` — VueDraggable DnD list (UUID keys), add-question with scroll + focus

## Verified End-to-End (Task 3)

- ✅ Add question appends, scrolls to it, focuses the textarea
- ✅ Type toggle, required toggle, question text edit
- ✅ Single-answer marks one correct; multiple allows several; option delete is immediate
- ✅ Drag reorder persists across refresh (`order_index` batch upsert)
- ✅ Delete question shows the confirmation dialog
- ✅ Publish blocked for invalid quizzes; a valid quiz publishes and appears on `/`

## Deviations / Incidents

- **reorderQuestions full-row upsert** — `questions.quiz_id` is NOT NULL with no default, so a partial `{id, order_index}` upsert would fail the INSERT path; the entity function sends full rows.
- **multiple → single reconciliation** — switching a question to single-answer initially left several radio buttons selected; fixed in `updateQuestion` (e34275f) by keeping only the first correct option.
- **Major UI overhaul mid-plan** — the app was re-skinned to a dark theme with orange accent (~28 files), the Switch replaced with PrimeVue ToggleSwitch, scrollbar and toasts darkened, editor layout moved to an `h-dvh` flex column, quiz cards reworked (fixed heights, 5-up grid, border-glow hover). Driven by user design review; overrides the light-mode UI-SPEC.

## Phase 1 — COMPLETE

All 4 plans done. An authenticated owner can register, log in, create/list/delete quizzes, edit metadata + cover + publish state + navigation settings, and build out questions with answer options, DnD reorder, and publish-time validation.
