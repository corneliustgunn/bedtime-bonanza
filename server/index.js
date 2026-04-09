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

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// ── Prompt data ─────────────────────────────────────────────────────────────

const WORD_COUNT_MAP      = { quick: 150, short: 300, medium: 500 }
const PARAGRAPH_COUNT_MAP = { quick: 3,   short: 4,   medium: 5   }
const STORY_LENGTH_MAP    = { quick: '1', short: '3', medium: '5' }
const MAX_TOKENS_MAP      = { quick: 450, short: 900,  medium: 1400 }

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
// Evocative beat guidance — describes the emotional shape of each paragraph, not a script.
const STORY_ARC = {
  3: `\
  Paragraph 1: Ground us in the world with the characters present. Let one sensory detail carry the whole scene — something they can hear, smell, or feel.
  Paragraph 2: Something small happens that puts the theme in motion. The characters respond through what they do, not what they say.
  Paragraph 3: The world settles. Close with two or three gentle sentences that wind the story down and end on the feeling the character is left with — not a stated lesson.`,

  4: `\
  Paragraph 1: Ground us in the world with the characters present. Let one sensory detail carry the whole scene.
  Paragraph 2: A small, gentle moment of choice or discovery appears — nothing scary, nothing loud. It connects naturally to the theme.
  Paragraph 3: The characters move through it. The theme shows in a concrete action or decision; the moment resolves with a quiet sense of rightness.
  Paragraph 4: The world settles. Close with two or three gentle sentences that wind the story down and end on the feeling the character is left with — not a stated lesson.`,

  5: `\
  Paragraph 1: Ground us in the world with the characters present. Let one sensory detail carry the whole scene.
  Paragraph 2: A small, gentle moment of choice or discovery appears — nothing scary, nothing loud. It connects naturally to the theme.
  Paragraph 3: The characters explore or try things. Each character's personality comes through in what they do; let the story breathe here.
  Paragraph 4: Something shifts. The theme lands in a concrete action or decision that feels earned — not announced.
  Paragraph 5: The world settles. Close with two or three gentle sentences that wind the story down and end on the feeling the character is left with — not a stated lesson.`,
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
  - The CLOSE paragraph should wind down gently over two or three sentences and end on the feeling the character carries — not a stated lesson.
    Good: "The sky had gone soft and orange. Mia leaned against Biscuit and let out a long, slow breath. She felt warm all the way to her toes."
    Bad: "And that is how Luna learned to share."

NARRATIVE STRUCTURE — write exactly ${paragraphCount} paragraphs:
${STORY_ARC[paragraphCount]}

LANGUAGE & TONE:
  - Simple words; sentences that feel natural aloud (aim for ~10–15 words; vary the rhythm)
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
    .filter((p) => {
      if (p.length === 0) return false
      // Drop the location if Claude repeated it as a standalone paragraph
      if (location && p.toLowerCase() === location.toLowerCase()) return false
      // Drop stray label fragments (too short, no sentence-ending punctuation)
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

  const themeRaw   = sanitize(settings.theme)
  const themeLabel = themeRaw
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const storySeed  = THEME_STORY_SEED[themeRaw] || `a story that explores the meaning of ${themeLabel}`

  const settingLabel = sanitize(settings.setting)
  const isFantasy    = FANTASY_SETTINGS.has(settingLabel)

  const sanitizedSpecial = sanitize(specialDetails)
  const contCtx = [
    sanitizedSpecial ? `Special elements to weave in: ${sanitizedSpecial}` : '',
    sanitize(continuationContext),
  ].filter(Boolean).join('\n')

  const systemPrompt = buildSystemPrompt({
    wordCount:      WORD_COUNT_MAP[settings.length],
    paragraphCount: PARAGRAPH_COUNT_MAP[settings.length],
    storyLength:    STORY_LENGTH_MAP[settings.length],
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
    const message = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: MAX_TOKENS_MAP[settings.length],
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
