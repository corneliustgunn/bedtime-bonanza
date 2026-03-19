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
const SYSTEM_PROMPT = `You are a gentle, imaginative storyteller who creates bedtime stories for children aged 2-5.

Rules you must follow:
- Use simple words a 2-year-old can understand. Short sentences (max 10 words each). Calm, soothing tone.
- Stories must have a clear beginning, middle, and end.
- Themes must be gentle: no scary villains, no violence, no death, no conflict that causes fear.
- The story must end with the characters feeling sleepy, cozy, or peacefully happy — gently encouraging the child to sleep.
- Represent the world's diversity naturally: settings, names, foods, landscapes, and traditions from many cultures are welcome and normal.
- Do not use generic filler words. Make sensory details specific and vivid (sounds, smells, textures).
- Each paragraph should be 2-3 short sentences, suitable for reading aloud at a slow, soothing pace.
- Never use these overused phrases: "painting the sky", "drifted off to dreamland", "stars twinkling like diamonds", "the sun smiled down", "a magical adventure", "snuggled up tight", "fast asleep", "drifting off", "twinkled in the night", "soft as a cloud". Find fresher, more specific images instead.
- Each paragraph must be anchored to a different sense: one paragraph focuses on a sound, another on a smell or texture, another on something seen up close — not from a distance. Vary which sense leads each paragraph.

Format your response EXACTLY like this (no extra text before or after):
TITLE: [a short, warm story title]
STORY:
[paragraph 1]

[paragraph 2]

[paragraph 3]

...and so on`

// Specific cultural/sensory details per setting — injected into the user prompt
// to ground stories in authentic local texture rather than generic descriptions.
const SETTING_DETAILS = {
  'African savanna':          ['red dust settling on your feet', 'the two-note call of a go-away bird', 'the sweet-sharp smell of marula fruit'],
  'Japanese countryside':     ['the loud shriek of cicadas in the trees', 'damp earth near a rice paddy after rain', 'the sharp green smell of cedar'],
  'Indian village':           ['the scent of jasmine garlands hung by the door', 'clay pots still warm from the kiln', 'the jingle of anklet bells nearby'],
  'Norwegian fjords':         ['cold mist settling on your cheeks', 'the distant splash of a gannet diving', 'pine resin and sea salt in the air'],
  'Mexican rainforest':       ['howler monkeys calling far in the canopy', 'the sticky sweetness of a ripe sapodilla', 'green light pouring through the ceiba branches'],
  'Moroccan medina':          ['the smell of cumin and saffron drifting from a nearby stall', 'cool painted tile under bare feet', 'the low beat of a darbuka drum'],
  'Australian outback':       ['fine red sand between your toes', 'a kookaburra laughing somewhere close', 'the sky turning deep orange near the rocks'],
  'Brazilian ocean coast':    ['warm wet sand pressing up between your toes', 'the fresh smell of green coconut water', 'waves shushing the shore again and again'],
  'Chinese mountain village': ['woodsmoke curling up past the rooftops', 'osmanthus blossoms with their apricot smell', 'thick white mist filling the valley below'],
  'Enchanted forest':         ['tiny mushrooms that glow faintly in the dark', 'a low hum in the air like something breathing', 'leaves chiming softly when the breeze passes'],
  'Underwater kingdom':       ['bubbles tickling the tip of your nose', 'sea grass swaying back and forth like slow hands', 'rippled light making blue-green patterns on everything'],
  'Snowy Arctic tundra':      ['your breath turning to a little white cloud', 'fresh snow squeaking under each step', 'silence so wide you can hear your own heartbeat'],
  'Busy city':                ['the smell of warm bread drifting from a bakery window', 'pigeons cooing softly on a ledge above', 'street lights blinking on one by one as the sky darkens'],
  'Floating sky islands':     ['clouds soft as rolled dough beneath your feet', 'wind that smells of rain and wildflowers at once', 'small birds glowing gold like paper lanterns'],
}

// Injected per request to vary vocabulary and push away from clichéd imagery.
const SENSORY_SEEDS = [
  'velvety', 'crinkly', 'bubbly', 'feather-soft', 'warm-bread-smell',
  'puddle-cool', 'mossy', 'honeyed', 'rumbling', 'glimmery',
  'squeaky', 'fizzy', 'dusty-warm', 'dewy', 'pillowy',
]

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

  const settingKey = sanitize(settings.setting)
  const culturalDetails = SETTING_DETAILS[settingKey] || []
  const culturalHint = culturalDetails.length > 0
    ? `Ground the story in this setting by naturally including at least one of these specific details: ${culturalDetails.join('; ')}.`
    : `Reflect the culture, landscape, food, and environment of "${settingKey}" naturally in the details.`

  const seed = SENSORY_SEEDS[Math.floor(Math.random() * SENSORY_SEEDS.length)]

  return `Write a bedtime story with these characters:

${characterLines.join('\n')}

The story takes place in: ${settingKey}.
The story is about: ${sanitize(settings.theme)}.
Total length: approximately ${wordCount} across all paragraphs.

Make sure every character listed appears in the story and plays a meaningful role.
${culturalHint}
Somewhere in the story, use a detail that evokes the feeling of something "${seed}" — weave it in naturally.
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
      model: 'claude-haiku-4-5-20251001',
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
