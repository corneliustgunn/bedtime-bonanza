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

// Trust Render's load balancer so express-rate-limit can read the real client IP
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGIN || false)
    : '*',
}))
app.use(express.json())

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many story requests. Please wait a few minutes and try again.' },
})

// ── Prompt builder ──────────────────────────────────────────────────────────
const sanitize = (str) => String(str || '').replace(/<[^>]*>/g, '').trim()

// Build a compact character description string, e.g. "Finn the red tractor, Mia the curious fox".
// The `appearance` field (optional, freeform) is used as the color/descriptor between name and type.
function buildCharDesc(characters) {
  return characters.map((c) => {
    const name = sanitize(c.name)
    const subtype = sanitize(c.subtype)
    const type = sanitize(c.type)
    const appearance = sanitize(c.appearance)
    const typePart = (subtype || type).toLowerCase()
    return appearance
      ? `${name} the ${appearance} ${typePart}`
      : `${name} the ${typePart}`
  }).join(', ')
}

function buildSystemPrompt({
  wordCount, storyLength, activeTheme, charDesc,
  specialDetails, avoidNames, avoidLocations, continuationContext,
}) {
  return `You are a warm, soothing bedtime story teller for toddlers aged 2–4.

STORY REQUIREMENTS:
- Target: ~${wordCount} words (${storyLength}-minute read)
- Theme: ${activeTheme}
- Main characters: ${charDesc}
${specialDetails ? `- Special elements to weave in: ${specialDetails}\n` : ''}- End the story with characters feeling peaceful, sleepy, or settled
- Simple, gentle language; soft rhythmic prose; no scary moments
- 3–5 short paragraphs

GLOBAL DIVERSITY (critical):
- Set the story in a specific, real place — a named village, market, landscape, or neighborhood
- Actively choose LESS commonly used settings. Avoid well-worn "diverse" defaults.
- AVOID these recently used locations: ${avoidLocations || 'none yet'}
- Draw from underrepresented regions: Central Asia, the Caucasus, Polynesia, the Baltic states, Central Africa, the Andes, the Arctic, Southeast Europe, the Caribbean, Appalachia, the Scottish Highlands, etc.
- Weave in cultural details (foods, greetings, clothing, music) lightly and warmly
- Supporting characters should have globally diverse names
- AVOID these recently used character names: ${avoidNames || 'none yet'}

LANGUAGE & IMAGERY:
- Vary descriptive language from story to story — avoid overused phrases
- NEVER use: "painted the sky", "painted the clouds", "the sun painted", "danced in the breeze", "twinkling stars", "soft golden light", "nestled in the", or "drifted off to sleep"
- Find fresh, specific, childlike ways to describe light, color, and nighttime
${continuationContext ? `\n${continuationContext}\n` : ''}
FORMAT (strict — follow exactly):
Line 1: Story title only (no prefix, no quotes, no markdown)
Line 2: Location (just the country or region name, nothing else)
Line 3: blank
Lines 4+: story paragraphs separated by blank lines
No headers, bullets, or bold text inside the story.`
}

function parseStoryResponse(text) {
  const lines = text.split('\n')
  const title = lines[0]?.trim() || 'A Bedtime Story'
  const location = lines[1]?.trim() || ''
  const body = lines.slice(2).join('\n').trim()
  const pages = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
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

  const wordCountMap  = { quick: 150, short: 300, medium: 450 }
  const storyLengthMap = { quick: '1', short: '2', medium: '3' }
  const maxTokensMap  = { quick: 400, short: 800, medium: 1200 }

  const charDesc = buildCharDesc(characters)
  const systemPrompt = buildSystemPrompt({
    wordCount: wordCountMap[settings.length],
    storyLength: storyLengthMap[settings.length],
    activeTheme: sanitize(settings.theme),
    charDesc,
    specialDetails: sanitize(specialDetails),
    avoidNames: sanitize(avoidNames),
    avoidLocations: sanitize(avoidLocations),
    continuationContext: sanitize(continuationContext),
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
