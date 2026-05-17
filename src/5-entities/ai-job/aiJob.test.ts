// aiJob.test.ts
// Unit tests for the ai-job entity api (invokeGenerateQuiz, fetchAiJob)
// and the fileToBase64 shared helper (plan 03-02 Task 1).

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Module mocks ──────────────────────────────────────────────────────────────
const invokeMock = vi.fn()
const singleMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => singleMock(),
        }),
      }),
    }),
  },
}))

import { invokeGenerateQuiz, fetchAiJob } from './api'
import { fileToBase64 } from '@shared/lib/file'

describe('ai-job api — invokeGenerateQuiz', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { jobId } on success', async () => {
    invokeMock.mockResolvedValue({ data: { jobId: 'job-1' }, error: null })
    const res = await invokeGenerateQuiz({
      title: 'T',
      sourceText: 'text',
      clarifyingPrompt: 'focus',
      questionCount: 10,
      difficulty: 'medium',
    })
    expect(res).toEqual({ jobId: 'job-1' })
    expect(invokeMock).toHaveBeenCalledWith('ai-generate-quiz', expect.objectContaining({
      body: expect.objectContaining({ title: 'T' }),
    }))
  })

  it('throws when the EF returns an error', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(
      invokeGenerateQuiz({
        title: 'T',
        clarifyingPrompt: 'f',
        questionCount: 5,
        difficulty: 'easy',
      }),
    ).rejects.toThrow('boom')
  })
})

describe('ai-job api — fetchAiJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the typed AiJob row on success', async () => {
    const row = { id: 'job-1', status: 'pending', stage: 'reading', error: null, quiz_id: null }
    singleMock.mockResolvedValue({ data: row, error: null })
    const job = await fetchAiJob('job-1')
    expect(job).toEqual(row)
  })

  it('throws on a PostgREST error', async () => {
    singleMock.mockResolvedValue({ data: null, error: new Error('rls') })
    await expect(fetchAiJob('job-1')).rejects.toThrow('rls')
  })
})

describe('fileToBase64', () => {
  it('resolves with the base64 payload only (data: prefix stripped)', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    const b64 = await fileToBase64(file)
    // "hello" -> base64 "aGVsbG8="
    expect(b64).toBe('aGVsbG8=')
    expect(b64).not.toContain('data:')
    expect(b64).not.toContain(',')
  })

  it('rejects when FileReader errors', async () => {
    const originalReadAsDataURL = FileReader.prototype.readAsDataURL
    FileReader.prototype.readAsDataURL = function () {
      setTimeout(() => {
        this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>)
      }, 0)
    }
    const file = new File(['x'], 'x.txt')
    await expect(fileToBase64(file)).rejects.toBeDefined()
    FileReader.prototype.readAsDataURL = originalReadAsDataURL
  })
})
