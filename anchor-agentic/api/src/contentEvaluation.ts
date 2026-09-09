// US-042: automated prompt/content quality checks, run at publish time
// alongside publishValidation.ts's structural checks. Per the AskUserQuestion
// decision, this is heuristic (pure code) rather than an LLM call, to respect
// the $20/month hosting cap — length thresholds, boilerplate/banned-phrase
// matching, and a unique-word-ratio check for repeated filler.

export interface QualityIssue {
  code: string
  message: string
}

const BOILERPLATE_PHRASES = new Set([
  'you are a helpful assistant',
  'todo',
  'tbd',
  'n/a',
  'na',
  'lorem ipsum',
  'placeholder',
  'coming soon',
  'insert instructions here',
  'test',
  'testing',
])

// Prompt-injection/jailbreak phrases and clearly-abusive-intent phrases —
// not an exhaustive blocklist, just a coarse first line of defense.
const BANNED_PATTERNS: RegExp[] = [
  /ignore (all )?previous instructions/i,
  /disregard all prior instructions/i,
  /ignore your (system )?prompt/i,
  /you are now (dan|jailbroken)/i,
  /hack into/i,
  /steal (credentials|passwords|data)/i,
]

function normalizeForBoilerplateCheck(text: string): string {
  return text.trim().toLowerCase().replace(/[.!?\s]+$/, '')
}

export function evaluatePromptText(
  text: string | null | undefined,
  options: { fieldName: string; minLength: number }
): QualityIssue[] {
  const { fieldName, minLength } = options
  const trimmed = typeof text === 'string' ? text.trim() : ''

  if (trimmed.length < minLength) {
    return [
      {
        code: 'prompt_too_short',
        message: `${fieldName} is shorter than the minimum of ${minLength} characters.`,
      },
    ]
  }

  const issues: QualityIssue[] = []

  if (BOILERPLATE_PHRASES.has(normalizeForBoilerplateCheck(trimmed))) {
    issues.push({
      code: 'boilerplate_content',
      message: `${fieldName} looks like unedited boilerplate or placeholder text.`,
    })
  }

  if (BANNED_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    issues.push({
      code: 'banned_pattern_detected',
      message: `${fieldName} contains a disallowed prompt-injection or abusive-intent phrase.`,
    })
  }

  const words = trimmed.toLowerCase().match(/[a-z0-9']+/g) ?? []
  if (words.length >= 20) {
    const uniqueRatio = new Set(words).size / words.length
    if (uniqueRatio < 0.15) {
      issues.push({
        code: 'low_content_diversity',
        message: `${fieldName} appears to be mostly repeated filler content.`,
      })
    }
  }

  if (trimmed.length > 50_000) {
    issues.push({
      code: 'content_too_long',
      message: `${fieldName} exceeds the maximum length of 50,000 characters.`,
    })
  }

  return issues
}

export function evaluateAgentPromptQuality(systemPrompt: string | null | undefined): QualityIssue[] {
  return evaluatePromptText(systemPrompt, { fieldName: 'system_prompt', minLength: 40 })
}

export function evaluateSkillPromptQuality(skillFiles: { content: string }[]): QualityIssue[] {
  const combined = skillFiles.map((f) => f.content ?? '').join('\n')
  return evaluatePromptText(combined, { fieldName: 'skill_files', minLength: 80 })
}

export function evaluateWorkflowPromptQuality(description: string | null | undefined): QualityIssue[] {
  return evaluatePromptText(description, { fieldName: 'description', minLength: 20 })
}
