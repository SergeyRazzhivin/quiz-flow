// Full JSONB shape for quizzes.settings
// Default: { allow_back: true, show_stop_button: true, shuffle_questions: false, shuffle_answers: false }
export interface QuizSettings {
  allow_back:        boolean
  show_stop_button:  boolean  // NAV-01 — required by UI-SPEC, maps to quizzes.settings JSONB
  shuffle_questions: boolean
  shuffle_answers:   boolean
}
