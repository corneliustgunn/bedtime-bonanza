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
const SYSTEM_PROMPT = `You are a gentle, imaginative storyteller who creates bedtime stories for children aged 2-5.

Rules you must follow:
- Use simple words a 2-year-old can understand. Short sentences (max 10 words each). Calm, soothing tone.
- Stories must have a clear beginning, middle, and end.
- Themes must be gentle: no scary villains, no violence, no death, no conflict that causes fear.
- The story must end with the characters feeling sleepy, cozy, or peacefully happy — gently encouraging the child to sleep.
- Represent the world's diversity naturally: settings, names, foods, landscapes, and traditions from many cultures are welcome and normal.
- Do not use generic filler words. Make sensory details specific and vivid (sounds, smells, textures).
- Each paragraph should be 2-3 short sentences, suitable for reading aloud at a slow, soothing pace.

Format your response EXACTLY like this (no extra text before or after):
TITLE: [a short, warm story title]
STORY:
[paragraph 1]

[paragraph 2]

[paragraph 3]

...and so on`

function buildUserPrompt(characters, settings) {
  const sanitize = (str) => String(str || '').replace(/<[^>]*>/g, '').trim()

  const characterLines = characters.map((c) => {
    const name = sanitize(c.name)
    const trait = sanitize(c.trait).toLowerCase()
    const appearance = sanitize(c.appearance)
    const subtype = sanitize(c.subtype)
    const type = sanitize(c.type)
    const description = subtype ? `${subtype} (${type.toLowerCase()})` : type.toLowerCase()
    const appearancePart = appearance ? ` with ${appearance}` : ''
    return `- ${name} is a ${trait} ${description}${appearancePart}.`
  })

  const wordCount = settings.length === 'quick' ? '80-100 words'
    : settings.length === 'short' ? '250-300 words'
    : '450-500 words'

  return `Write a bedtime story with these characters:

${characterLines.join('\n')}

The story takes place in: ${sanitize(settings.setting)}.
The story is about: ${sanitize(settings.theme)}.
Total length: approximately ${wordCount} across all paragraphs.

Make sure every character listed appears in the story and plays a meaningful role.
Reflect the culture, landscape, food, and environment of "${sanitize(settings.setting)}" naturally in the details.
End the story gently so the child listening feels sleepy and safe.`
}

function parseStoryResponse(text) {
  const titleMatch = text.match(/TITLE:\s*(.+)/i)
  const storyMatch = text.match(/STORY:\s*([\s\S]+)/i)

  const title = titleMatch ? titleMatch[1].trim() : 'A Bedtime Story'
  const rawStory = storyMatch ? storyMatch[1].trim() : text.trim()

  const pages = rawStory
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  return { title, pages }
}

// ── Routes ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/story', limiter, async (req, res) => {
  const { characters, settings } = req.body

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

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const maxTokens = settings.length === 'quick' ? 300
      : settings.length === 'short' ? 600
      : 900

    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(characters, settings) }],
    })

    const rawText = message.content[0].text
    const { title, pages } = parseStoryResponse(rawText)

    res.json({ title, pages })
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
