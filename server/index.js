import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import Anthropic from '@anthropic-ai/sdk'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGIN || false)
    : '*',
}))
app.use(express.json())

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many story requests. Please wait a few minutes and try again.' },
})

// ── Prompt data ─────────────────────────────────────────────────────────────

// Settings the UI treats as fantastical (no real-world location line)
const FANTASY_SETTINGS = new Set(['Enchanted forest', 'Underwater kingdom', 'Floating sky islands'])

// Per-theme story seed: gives Claude a concrete plot hook rather than just a word.
// Each seed describes what kind of moment or event should drive the story.
const THEME_STORY_SEED = {
  friendship:    'two characters who don\'t yet know each other well discover they genuinely need each other',
  kindness:      'a character notices someone struggling and chooses to help, even when they didn\'t have to',
  bravery:       'a character faces something new or slightly scary and takes a small, courageous step forward',
  curiosity:     'a character wonders about something, explores to find out, and discovers something delightful',
  sharing:       'a character has something they love and finds that sharing it makes the joy grow bigger',
  patience:      'something a character wants takes longer than expected; the waiting itself becomes something worth having',
  creativity:    'a character faces a small problem that can only be solved by thinking in an unexpected way',
  empathy:       'a character realizes how another is feeling and responds in a way that truly helps',
  perseverance:  'a character struggles with something difficult, nearly gives up, then tries one more time and succeeds',
  gratitude:     'a character pauses to notice something they\'ve been taking for granted and feels the warmth of truly appreciating it',
  honesty:       'a character makes a small mistake and chooses to tell the truth, finding that honesty brings relief',
  acceptance:    'a character meets someone quite different from themselves and discovers unexpected joy in that difference',
  helpfulness:   'a character sees something that needs doing and simply helps — without being asked',
  joy:           'ordinary moments overflow with delight as characters find wonder in small things around them',
  imagination:   'a character uses imagination to transform an everyday moment into something magical and surprising',
  family:        'characters share a small, quiet moment of caring that shows how much they mean to each other',
  'self-love':   'a character learns to appreciate something unique about themselves that they once felt unsure about',
  'growing-up':  'a character does something for the first time and discovers they are more capable than they knew',
  nature:        'characters are drawn into the living rhythms of the natural world — sounds, smells, creatures — around them',
  dreams:        'characters drift through a sequence of warm, peaceful imaginings as the world grows quiet and still',
  learning:      'a character is puzzled by something, asks questions, and the answer opens a door to something wonderful',
}

// Narrative arc templates keyed by paragraph count.
// Each entry describes exactly what each paragraph must accomplish.
const STORY_ARC = {
  3: `\
  Paragraph 1 — OPEN: Introduce the characters in their world. One warm, specific sensory image sets the scene.
  Paragraph 2 — HEART: A small moment happens that embodies the theme. Characters act; the lesson shows in what they do, not in what they say.
  Paragraph 3 — CLOSE: The world grows quiet. End with one sentence that names the feeling the character carries — not the lesson itself.`,

  4: `\
  Paragraph 1 — OPEN: Introduce the characters in their world. One warm, specific sensory image sets the scene.
  Paragraph 2 — SPARK: A small, gentle challenge or moment of choice appears — connected naturally to the theme. No villains, no fear.
  Paragraph 3 — TURN: Characters respond. The theme plays out in a concrete action or decision. The challenge resolves.
  Paragraph 4 — CLOSE: The world grows quiet. End with one sentence that names the feeling the character carries — not the lesson itself.`,

  5: `\
  Paragraph 1 — OPEN: Introduce the characters in their world. One warm, specific sensory image sets the scene.
  Paragraph 2 — SPARK: A small, gentle challenge or moment of choice appears — connected naturally to the theme. No villains, no fear.
  Paragraph 3 — HEART: Characters explore or try things. Show each character's personality through what they do, not just what they say.
  Paragraph 4 — TURN: The theme plays out in a concrete action or decision. The challenge resolves in a way that feels earned.
  Paragraph 5 — CLOSE: The world grows quiet. End with one sentence that names the feeling the character carries — not the lesson itself.`,
}

// ── Prompt builder ──────────────────────────────────────────────────────────
const sanitize = (str) => String(str || '').replace(/<[^>]*>/g, '').trim()

// Build a structured character block that exposes name, type, personality, and appearance.
// Personality (trait) is the most important field — it must shape what the character does in the plot.
function buildCharacterBlock(characters) {
  return characters.map((c) => {
    const name      = sanitize(c.name)
    const trait     = sanitize(c.trait)
    const subtype   = sanitize(c.subtype)
    const type      = sanitize(c.type)
    const appearance = sanitize(c.appearance)
    const typePart  = subtype ? `${subtype} (${type.toLowerCase()})` : type.toLowerCase()
    const appPart   = appearance ? `; appearance: ${appearance}` : ''
    return `  - ${name}: ${trait.toLowerCase()} ${typePart}${appPart}`
  }).join('\n')
}

function buildSystemPrompt({
  wordCount, paragraphCount, storyLength,
  themeLabel, storySeed,
  characterBlock,
  settingLabel, isFantasy,
  avoidNames, avoidLocations,
  continuationContext,
}) {
  const settingInstruction = isFantasy
    ? `The story is set in a ${settingLabel}. Invent one specific, charming place name within this world and use it in the story. Weave in 1–2 sensory details that make this fantastical place feel cozy and real.`
    : `The story takes place in the ${settingLabel}. Choose a specific named village, neighborhood, market, or natural landmark within this region. Use that real place name in the story. Weave in 1–2 authentic sensory or cultural details (a local food, a sound, clothing, a greeting) from that place.`

  const locationAvoidLine = isFantasy
    ? ''
    : `  - AVOID these recently used locations: ${avoidLocations || 'none yet'}\n`

  return `You are a warm, soothing bedtime storyteller for children aged 2–5.

CHARACTERS:
${characterBlock}
  - Each character listed must appear and play a meaningful role in the story.
  - A character's personality trait must shape what they DO, not just how they are described.
  - Supporting characters you invent should have globally diverse names.
  - AVOID these recently used names for supporting roles: ${avoidNames || 'none yet'}

WORLD / SETTING:
  ${settingInstruction}
  - IMPORTANT: Do NOT open the story by stating or announcing the setting. Reveal the place through sensory details woven naturally into the narrative. Never write a sentence like "Our story takes place in…" or "In a village called…" as an opening.
${locationAvoidLine}
THEME & LESSON — ${themeLabel}:
  Story hook: ${storySeed}
  - Build the plot around this hook. It is the engine of the story.
  - Show the theme through a concrete moment or action — never state it directly (not: "this was kindness").
  - The CLOSE paragraph must end with one quiet sentence that names the FEELING, not the lesson.
    Good: "She felt warm all the way to her toes."
    Bad: "And that is how Luna learned to share."

NARRATIVE STRUCTURE — write exactly ${paragraphCount} paragraphs:
${STORY_ARC[paragraphCount]}

LANGUAGE & TONE:
  - Simple words; short sentences (max ~12 words each); calm, rhythmic, read-aloud flow
  - No scary villains, no violence, no fear — gentle challenges only
  - Specific, sensory detail over generic description (what does it smell like? sound like? feel like?)
  - NEVER use: "painted the sky", "painted the clouds", "the sun painted", "danced in the breeze",
    "twinkling stars", "soft golden light", "nestled in the", "drifted off to sleep",
    "magical adventure", "fast asleep", "snuggled up tight"
  - Target: ~${wordCount} words total (${storyLength}-minute read)
${continuationContext ? `\nCONTINUATION CONTEXT:\n${continuationContext}\n` : ''}
FORMAT — follow exactly, no exceptions:
  Line 1: Story title only (short, warm; no prefix, no quotes, no markdown)
  Line 2: Location (country name, region name, or fantastical realm name — nothing else)
  Line 3: blank
  Lines 4+: story paragraphs, each separated by exactly one blank line
  No headers, labels, bullets, or bold text inside the story body.
  The location appears ONLY on line 2. Do not repeat or restate it anywhere in the story paragraphs.`
}

function parseStoryResponse(text) {
  const lines = text.split('\n')
  const title    = lines[0]?.trim() || 'A Bedtime Story'
  const location = lines[1]?.trim() || ''
  const body     = lines.slice(2).join('\n').trim()
  const pages    = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p) => {
      // Drop any paragraph that is just the location repeated (Claude sometimes
      // outputs it as a standalone line in the body despite the format instruction)
      if (location && p.toLowerCase() === location.toLowerCase()) return false
      // Drop very short paragraphs with no sentence-ending punctuation —
      // these are stray labels, not story content
      if (p.length < 40 && !/[.!?]/.test(p)) return false
      return true
    })
  return { title, location, pages }
}

// ── Routes ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/story', limiter, async (req, res) => {
  const {
    characters, settings,
    avoidNames, avoidLocations,
    specialDetails, continuationContext,
  } = req.body

  // Validation
  if (!Array.isArray(characters) || characters.length === 0) {
    return res.status(400).json({ error: 'At least one character is required.' })
  }
  if (characters.length > 4) {
    return res.status(400).json({ error: 'Maximum 4 characters allowed.' })
  }
  for (const c of characters) {
    if (!c.name || !c.type || !c.trait) {
      return res.status(400).json({ error: 'Each character needs a name, type, and trait.' })
    }
  }
  if (!settings?.setting || !settings?.theme || !settings?.length) {
    return res.status(400).json({ error: 'Story setting, theme, and length are required.' })
  }
  if (!['quick', 'short', 'medium'].includes(settings.length)) {
    return res.status(400).json({ error: 'Length must be "quick", "short", or "medium".' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Story service is not configured. Please set ANTHROPIC_API_KEY.' })
  }

  const wordCountMap      = { quick: 150, short: 300, medium: 500 }
  const paragraphCountMap = { quick: 3,   short: 4,   medium: 5   }
  const storyLengthMap    = { quick: '1', short: '3', medium: '5' }
  const maxTokensMap      = { quick: 450, short: 900,  medium: 1400 }

  const themeRaw   = sanitize(settings.theme)
  const themeLabel = themeRaw
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const storySeed  = THEME_STORY_SEED[themeRaw] || `a story that explores the meaning of ${themeLabel}`

  const settingLabel = sanitize(settings.setting)
  const isFantasy    = FANTASY_SETTINGS.has(settingLabel)

  // specialDetails is not yet in the UI; it wires through when a future field adds it
  const contCtx = [
    sanitize(specialDetails) ? `Special elements to weave in: ${sanitize(specialDetails)}` : '',
    sanitize(continuationContext),
  ].filter(Boolean).join('\n')

  const systemPrompt = buildSystemPrompt({
    wordCount:      wordCountMap[settings.length],
    paragraphCount: paragraphCountMap[settings.length],
    storyLength:    storyLengthMap[settings.length],
    themeLabel,
    storySeed,
    characterBlock: buildCharacterBlock(characters),
    settingLabel,
    isFantasy,
    avoidNames:     sanitize(avoidNames),
    avoidLocations: sanitize(avoidLocations),
    continuationContext: contCtx,
  })

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokensMap[settings.length],
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Write the story now.' }],
    })

    const rawText = message.content[0].text
    const { title, location, pages } = parseStoryResponse(rawText)

    res.json({ title, location, pages })
  } catch (err) {
    console.error('Claude API error:', err)
    if (err.status === 401) {
      return res.status(502).json({ error: 'Story service authentication failed.' })
    }
    if (err.status === 429) {
      return res.status(429).json({ error: 'Story service is busy. Please try again in a moment.' })
    }
    res.status(502).json({ error: 'Could not generate story. Please try again.' })
  }
})

// ── Static serving (production) ──────────────────────────────────────────────
const distPath = join(__dirname, '..', 'client', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')))
}

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
