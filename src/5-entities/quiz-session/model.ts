// Domain interfaces for quiz sessions and results.

export interface QuizSession {
  id:             string
  quiz_access_id: string
  quiz_id:        string
  started_at:     string      // ISO — server-authoritative for timer (RESEARCH Pitfall timer drift)
  finished_at:    string | null
  score:          number | null  // numeric after migration 009 (D-18)
}

export interface SessionAnswer {
  id:                  string
  session_id:          string
  question_id:         string
  selected_option_ids: string[]
}

// Shape of data returned by get-quiz-result EF (02-05)
export interface SessionResult {
  score:          number
  totalQuestions: number
  percentage:     number
  label:          string  // quiz_access.label (taker name)
}
