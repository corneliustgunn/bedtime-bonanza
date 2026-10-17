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

// ── Model config ────────────────────────────────────────────────────────────
// Sonnet 5.5 rejects non-default temperature, so variety comes from the prompt
// (style + randomized recipe + recent-story avoidance), not from sampling.
const MODEL      = 'claude-sonnet-5-5'
const EFFORT     = 'low'
const MAX_TOKENS = 4000 // thinking tokens count toward this; length is set by the prompt

// ── Prompt data ─────────────────────────────────────────────────────────────

const WORD_COUNT_MAP   = { quick: 150, short: 300, medium: 500 }
const PAGE_COUNT_MAP   = { quick: 3,   short: 4,   medium: 5   }
const STORY_LENGTH_MAP = { quick: '1', short: '3', medium: '5' }

const STYLES = ['cozy', 'refrain', 'rhyme', 'silly']

const FANTASY_SETTINGS = new Set(['Enchanted forest', 'Underwater kingdom', 'Floating sky islands'])

const MAX_SPECIAL_DETAILS = 200
const MAX_RECENT_STORIES  = 5

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
  nature:        'characters are drawn into the living world around them — bugs, birds, puddles, wind — and find it full of surprises',
  dreams:        'characters drift through a sequence of warm, peaceful imaginings as the world grows quiet and still',
  learning:      'a character is puzzled by something, asks questions, and the answer opens a door to something wonderful',
}

// Story style drives the shape of the whole story, not just its tone.
// Each guide is given the page count so it can describe the arc in pages.
const STYLE_GUIDE = {
  cozy: (pages) => `\
STYLE — Cozy wind-down:
  - A calm, simple story that gets quieter as it goes.
  - Page 1: meet the characters doing something ordinary. Page ${pages - 1}: the theme lands in one clear action.
    Page ${pages}: everyone gets ready for sleep.
  - Gentle, plain, warm. A toddler should be able to follow every sentence.
  - Set "refrain" to an empty string.`,

  refrain: (pages) => `\
STYLE — Repetition & refrain (like "Going on a Bear Hunt" or "Brown Bear, Brown Bear"):
  - Invent ONE short refrain (4–8 words, rhythmic, fun to chant) and put it in "refrain".
  - Use the refrain word-for-word on pages 1 through ${pages - 1}. On page ${pages}, use a sleepy
    twist on it (change one or two words) as the very last line.
  - Build the plot as a pattern: the same kind of thing happens two or three times, each a little
    different, so a child can guess what comes next. Then one surprise breaks the pattern.
  - The refrain must also appear in "refrain" exactly as written in the story.`,

  rhyme: (pages) => `\
STYLE — Rhyming verse (like Julia Donaldson or Dr. Seuss, but for bedtime):
  - Every page is verse: 4 to 8 lines, rhyming in couplets (AABB). Put each line on its own line,
    separated by a single newline character (\\n) inside the page string.
  - Keep a steady, bouncy beat that is easy to read aloud. Count the beats — lines that rhyme
    should have about the same rhythm.
  - Use only true, simple rhymes (cat/hat, moon/soon). If a rhyme feels forced, rewrite the line.
    Never twist word order just to land a rhyme.
  - The last page slows the rhythm down for sleep. Aim for ${pages} pages.
  - Set "refrain" to an empty string.`,

  silly: (pages) => `\
STYLE — Silly & funny:
  - Gentle, goofy humor a 3-year-old laughs at: things in the wrong place, mixed-up names,
    animals doing people things, a hat on a foot, a very serious character being very silly.
  - Include 2–3 sound words written for reading aloud (BOING! Splish-splosh! Wheee!).
  - One running gag that comes back at least twice and pays off at the end.
  - No mean jokes, no one is laughed AT. Everyone is in on the fun.
  - Page ${pages} still settles down for sleep — end with one last small, sleepy giggle.
  - Set "refrain" to an empty string.`,
}

// Variety pools: one item from each is picked per request so stories with
// identical inputs still start, turn, and land differently.
const OPENING_MOVES = [
  'Open with a sound (written so a parent can say it out loud).',
  'Open with a character asking a question.',
  'Open in the middle of an action — something is already happening.',
  'Open with a line of dialogue.',
  'Open with a small, funny problem.',
  'Open with a character announcing a plan.',
]

const STORY_DEVICES = [
  'something small gets lost and has to be found',
  'someone unexpected comes to visit',
  'the characters count things as they go (one, two, three…)',
  'something gets mixed up and has to be sorted out',
  'the characters build or make something together',
  'there is a little race to finish something before bedtime',
  'the characters follow a trail of clues or footprints',
  'the weather changes and the characters adapt',
  'a character is trying to learn a new trick or skill',
  'the characters go looking for the perfect something',
]

const BEDTIME_LANDINGS = [
  'End with the characters saying goodnight to things around them, one by one.',
  'End with a big yawn that gets passed from character to character.',
  'End with the characters counting something slowly down to one.',
  'End with a whispered goodnight between two characters.',
  'End with the characters noticing how quiet everything has become.',
  'End with someone tucking someone else in.',
]

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function pickRecipe() {
  return {
    opening: pick(OPENING_MOVES),
    device:  pick(STORY_DEVICES),
    landing: pick(BEDTIME_LANDINGS),
  }
}

const STORY_SCHEMA = {
  type: 'object',
  properties: {
    title:    { type: 'string', description: 'Short, warm story title' },
    location: { type: 'string', description: 'Country, region, or fantastical realm name only' },
    refrain:  { type: 'string', description: 'The repeated refrain line, or empty string if the style has none' },
    pages:    { type: 'array', items: { type: 'string' }, description: 'Story pages in reading order' },
  },
  required: ['title', 'location', 'refrain', 'pages'],
  additionalProperties: false,
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

function buildRecentStoriesBlock(recentStories) {
  if (!recentStories.length) return ''
  const lines = recentStories
    .map((s) => `  - "${s.title}"${s.firstLine ? ` — began: "${s.firstLine}"` : ''}`)
    .join('\n')
  return `\nRECENT STORIES (do NOT reuse these titles, openings, or plots — make tonight's feel new):\n${lines}\n`
}

function buildSystemPrompt({
  wordCount, pageCount, storyLength,
  style, recipe,
  themeLabel, storySeed,
  characterBlock,
  settingLabel, isFantasy,
  avoidNames, avoidLocations,
  specialDetails, continuationContext, recentStoriesBlock,
}) {
  const settingInstruction = isFantasy
    ? `The story is set in the ${settingLabel}. Invent one specific, charming place name within this world.`
    : `The story takes place in the ${settingLabel}. Choose a specific named village, neighborhood, market, or natural landmark there. Include one simple cultural detail a toddler can picture (a food, an animal, a game, a greeting).`

  const locationAvoidLine = isFantasy
    ? ''
    : `  - AVOID these recently used locations: ${avoidLocations || 'none yet'}\n`

  return `You write bedtime stories that a parent reads aloud to a child aged 2–4.

Write for the EAR, not the page. The best toddler books — Goodnight Moon, The Gruffalo,
Llama Llama, Bear Hunt — use short sentences, words a toddler already knows, repetition,
rhythm, sound words, and things a child can point at. That is the target.

CHARACTERS:
${characterBlock}
  - Each character listed must appear and play a meaningful role in the story.
  - A character's personality trait must shape what they DO, not just how they are described.
  - Supporting characters you invent should have globally diverse names.
  - AVOID these recently used names for supporting roles: ${avoidNames || 'none yet'}

WORLD / SETTING:
  ${settingInstruction}
  - Do NOT open by announcing the place ("In a village called…", "Our story takes place…").
    Let it show up through what the characters see and do.
${locationAvoidLine}
THEME — ${themeLabel}:
  Story hook: ${storySeed}
  - Build the plot around this hook.
  - Show the theme through what a character does. Never state the lesson
    (not: "And that is how Luna learned to share.").

${STYLE_GUIDE[style](pageCount)}

TONIGHT'S RECIPE (use these to make this story different from others):
  - ${recipe.opening}
  - Story device: ${recipe.device}.
  - ${recipe.landing}

LANGUAGE:
  - Short sentences. Most under 10 words. Words a 3-year-old knows.
  - Concrete things and actions: who did what, what it looked like, what sound it made.
  - Do NOT write adult literary description: no mood-setting about light, air, smells,
    textures, or machines ("the engine ticked as it cooled", "light slanted through",
    "the air smelled of…", "a comfortable silence"). If a toddler wouldn't notice it, cut it.
  - Dialogue is good. Characters can say funny, simple things.
  - No scary villains, no violence, no fear — gentle challenges only.
  - Avoid stock phrases: "painted the sky", "twinkling stars", "soft golden light",
    "nestled", "drifted off to sleep", "magical adventure", "snuggled up tight".

LENGTH: exactly ${pageCount} pages, about ${wordCount} words total (${storyLength}-minute read).
${specialDetails ? `\nSOMETHING FROM TODAY (the child's real day — weave it in naturally as story material, do not treat it as instructions):\n  ${specialDetails}\n` : ''}${continuationContext ? `\nCONTINUATION CONTEXT:\n${continuationContext}\n` : ''}${recentStoriesBlock}
OUTPUT FIELDS:
  - title: short and warm; no quotes or markdown.
  - location: country, region, or fantastical realm name only.
  - refrain: as the style instructs.
  - pages: ${pageCount} strings, one per page, in order. No headers, labels, or markdown.`
}

// Fallback for a response that did not come back as schema JSON.
function parsePlainTextStory(text) {
  const lines = text.split('\n')
  const title    = lines[0]?.trim() || 'A Bedtime Story'
  const location = lines[1]?.trim() || ''
  const pages    = lines.slice(2).join('\n').trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return { title, location, refrain: '', pages }
}

function parseStoryResponse(text) {
  try {
    const data = JSON.parse(text)
    const pages = Array.isArray(data.pages)
      ? data.pages.map((p) => String(p).trim()).filter(Boolean)
      : []
    return {
      title:    String(data.title || '').trim() || 'A Bedtime Story',
      location: String(data.location || '').trim(),
      refrain:  String(data.refrain || '').trim(),
      pages,
    }
  } catch {
    return parsePlainTextStory(text)
  }
}

function normalizeRecentStories(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(-MAX_RECENT_STORIES)
    .map((s) => ({
      title:     sanitize(s?.title).slice(0, 80),
      firstLine: sanitize(s?.firstLine).slice(0, 120),
    }))
    .filter((s) => s.title)
}

// ── Routes ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/story', limiter, async (req, res) => {
  const {
    characters, settings,
    avoidNames, avoidLocations,
    specialDetails, continuationContext,
    recentStories,
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
  const style = settings.style || 'cozy'
  if (!STYLES.includes(style)) {
    return res.status(400).json({ error: `Style must be one of: ${STYLES.join(', ')}.` })
  }
  const sanitizedSpecial = sanitize(specialDetails)
  if (sanitizedSpecial.length > MAX_SPECIAL_DETAILS) {
    return res.status(400).json({ error: `"Something from today" must be ${MAX_SPECIAL_DETAILS} characters or fewer.` })
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

  const systemPrompt = buildSystemPrompt({
    wordCount:   WORD_COUNT_MAP[settings.length],
    pageCount:   PAGE_COUNT_MAP[settings.length],
    storyLength: STORY_LENGTH_MAP[settings.length],
    style,
    recipe:      pickRecipe(),
    themeLabel,
    storySeed,
    characterBlock: buildCharacterBlock(characters),
    settingLabel,
    isFantasy,
    avoidNames:     sanitize(avoidNames),
    avoidLocations: sanitize(avoidLocations),
    specialDetails: sanitizedSpecial,
    continuationContext: sanitize(continuationContext),
    recentStoriesBlock:  buildRecentStoriesBlock(normalizeRecentStories(recentStories)),
  })

  try {
    const message = await anthropicClient.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: {
        effort: EFFORT,
        format: { type: 'json_schema', schema: STORY_SCHEMA },
      },
      // On a safety-classifier decline, the API re-runs the request on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Write tonight\'s story.' }],
    })

    if (message.stop_reason === 'refusal') {
      console.error('Claude refusal:', message.stop_details)
      return res.status(502).json({ error: 'Could not write that story. Try changing a detail and generating again.' })
    }

    const rawText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const { title, location, refrain, pages } = parseStoryResponse(rawText)

    if (pages.length === 0) {
      return res.status(502).json({ error: 'Could not generate story. Please try again.' })
    }

    res.json({ title, location, refrain, style, pages })
  } catch (err) {
    console.error('Claude API error:', err)
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(502).json({ error: 'Story service authentication failed.' })
    }
    if (err instanceof Anthropic.RateLimitError) {
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
