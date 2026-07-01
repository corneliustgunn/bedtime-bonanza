# Bedtime Bonanza — Prompt Refinement Brief

This document is a self-contained briefing for refining the Claude API prompt used in **Bedtime Bonanza**, a personalised bedtime story generator for children aged 2–5. You have the full current prompt, all supporting data, the known problems, and a set of specific questions. Please work through the questions at the end.

---

## 1. App Context

Parents open the app, build 1–4 characters (name, type, personality trait, optional appearance), then pick a setting, theme, and story length. The app posts to a Node/Express server which calls Claude and returns a structured story — a title, a location, and 3–5 paragraphs displayed one at a time like a picture-book page-turn.

**Characters:** Human, Animal, Truck, Fantasy Creature, Other  
**Traits:** Brave, Curious, Kind, Funny, Shy, Adventurous, Gentle, Playful  
**Story lengths:** 1 min (3 paragraphs, ~150 words), 3 min (4 paragraphs, ~300 words), 5 min (5 paragraphs, ~500 words)

---

## 2. API Call Shape

```
model:      claude-haiku-4-5-20251001
max_tokens: 450  (1-min) | 900  (3-min) | 1400 (5-min)
temperature: 1.0 (default)
system:     <see Section 3>
messages:   [{ role: "user", content: "Write the story now." }]
```

---

## 3. Full Current System Prompt

Below is the system prompt rendered with real values for a representative request:  
**2 characters** (Mia, a kind human girl; Biscuit, a gentle golden retriever), **Scottish Highlands**, **Kindness** theme, **4 paragraphs** (3-min story), no previously used names or locations.

```
You are a warm, soothing bedtime storyteller for children aged 2–5.

CHARACTERS:
  - Mia: kind girl (human)
  - Biscuit: gentle golden retriever (animal)
  - Each character listed must appear and play a meaningful role in the story.
  - A character's personality trait must shape what they DO, not just how they are described.
  - Supporting characters you invent should have globally diverse names.
  - AVOID these recently used names for supporting roles: none yet

WORLD / SETTING:
  The story takes place in the Scottish Highlands. Choose a specific named village,
  neighborhood, market, or natural landmark within this region. Use that real place name
  in the story. Weave in 1–2 authentic sensory or cultural details (a local food, a sound,
  clothing, a greeting) from that place.
  - IMPORTANT: Do NOT open the story by stating or announcing the setting. Reveal the place
    through sensory details woven naturally into the narrative. Never write a sentence like
    "Our story takes place in…" or "In a village called…" as an opening.
  - AVOID these recently used locations: none yet

THEME & LESSON — Kindness:
  Story hook: a character notices someone struggling and chooses to help, even when they
  didn't have to
  - Build the plot around this hook. It is the engine of the story.
  - Show the theme through a concrete moment or action — never state it directly
    (not: "this was kindness").
  - The CLOSE paragraph should wind down gently over two or three sentences and end on
    the feeling the character carries — not a stated lesson.
    Good: "The sky had gone soft and orange. Mia leaned against Biscuit and let out a long,
           slow breath. She felt warm all the way to her toes."
    Bad:  "And that is how Luna learned to share."

NARRATIVE STRUCTURE — write exactly 4 paragraphs:
  Paragraph 1: Ground us in the world with the characters present. Let one sensory detail
               carry the whole scene.
  Paragraph 2: A small, gentle moment of choice or discovery appears — nothing scary,
               nothing loud. It connects naturally to the theme.
  Paragraph 3: The characters move through it. The theme shows in a concrete action or
               decision; the moment resolves with a quiet sense of rightness.
  Paragraph 4: The world settles. Close with two or three gentle sentences that wind the
               story down and end on the feeling the character is left with — not a stated lesson.

LANGUAGE & TONE:
  - Simple words; sentences that feel natural aloud (aim for ~10–15 words; vary the rhythm)
  - No scary villains, no violence, no fear — gentle challenges only
  - Specific, sensory detail over generic description (what does it smell like? sound like?
    feel like?)
  - NEVER use: "painted the sky", "painted the clouds", "the sun painted", "danced in the
    breeze", "twinkling stars", "soft golden light", "nestled in the", "drifted off to sleep",
    "magical adventure", "fast asleep", "snuggled up tight"
  - Target: ~300 words total (3-minute read)

FORMAT — follow exactly, no exceptions:
  Line 1: Story title only (short, warm; no prefix, no quotes, no markdown)
  Line 2: Location (country name, region name, or fantastical realm name — nothing else)
  Line 3: blank
  Lines 4+: story paragraphs, each separated by exactly one blank line
  No headers, labels, bullets, or bold text inside the story body.
  The location appears ONLY on line 2. Do not repeat or restate it anywhere in the story paragraphs.
```

---

## 4. All Prompt Data

### 4a. Settings (19 total)

| Setting label | Type |
|---|---|
| African savanna | Real-world |
| Japanese countryside | Real-world |
| Indian village | Real-world |
| Norwegian fjords | Real-world |
| Mexican rainforest | Real-world |
| Moroccan medina | Real-world |
| Australian outback | Real-world |
| Brazilian ocean coast | Real-world |
| Chinese mountain village | Real-world |
| Snowy Arctic tundra | Real-world |
| Busy city | Real-world |
| Scottish Highlands | Real-world |
| Saharan oasis | Real-world |
| Pacific island village | Real-world |
| Himalayan village | Real-world |
| Caribbean coast | Real-world |
| Enchanted forest | Fantasy |
| Underwater kingdom | Fantasy |
| Floating sky islands | Fantasy |

For **real-world** settings, the prompt instructs Claude to "choose a specific named village, neighborhood, market, or natural landmark within this region" and weave in 1–2 cultural/sensory details.

For **fantasy** settings, Claude invents a charming place name and 1–2 details that make it feel cozy.

### 4b. Themes and Story Seeds (21 total)

The `THEME_STORY_SEED` gives Claude a concrete plot hook per theme. These are injected verbatim into the prompt.

| Theme | Story seed |
|---|---|
| Friendship | two characters who don't yet know each other well discover they genuinely need each other |
| Kindness | a character notices someone struggling and chooses to help, even when they didn't have to |
| Bravery | a character faces something new or slightly scary and takes a small, courageous step forward |
| Curiosity | a character wonders about something, explores to find out, and discovers something delightful |
| Sharing | a character has something they love and finds that sharing it makes the joy grow bigger |
| Patience | something a character wants takes longer than expected; the waiting itself becomes something worth having |
| Creativity | a character faces a small problem that can only be solved by thinking in an unexpected way |
| Empathy | a character realizes how another is feeling and responds in a way that truly helps |
| Perseverance | a character struggles with something difficult, nearly gives up, then tries one more time and succeeds |
| Gratitude | a character pauses to notice something they've been taking for granted and feels the warmth of truly appreciating it |
| Honesty | a character makes a small mistake and chooses to tell the truth, finding that honesty brings relief |
| Acceptance | a character meets someone quite different from themselves and discovers unexpected joy in that difference |
| Helpfulness | a character sees something that needs doing and simply helps — without being asked |
| Joy | ordinary moments overflow with delight as characters find wonder in small things around them |
| Imagination | a character uses imagination to transform an everyday moment into something magical and surprising |
| Family | characters share a small, quiet moment of caring that shows how much they mean to each other |
| Self-love | a character learns to appreciate something unique about themselves that they once felt unsure about |
| Growing Up | a character does something for the first time and discovers they are more capable than they knew |
| Nature | characters are drawn into the living rhythms of the natural world — sounds, smells, creatures — around them |
| Dreams | characters drift through a sequence of warm, peaceful imaginings as the world grows quiet and still |
| Learning | a character is puzzled by something, asks questions, and the answer opens a door to something wonderful |

### 4c. Narrative Arc Templates (STORY_ARC)

**3 paragraphs (1-min story):**
```
Paragraph 1: Ground us in the world with the characters present. Let one sensory detail
             carry the whole scene — something they can hear, smell, or feel.
Paragraph 2: Something small happens that puts the theme in motion. The characters respond
             through what they do, not what they say.
Paragraph 3: The world settles. Close with two or three gentle sentences that wind the story
             down and end on the feeling the character is left with — not a stated lesson.
```

**4 paragraphs (3-min story):**
```
Paragraph 1: Ground us in the world with the characters present. Let one sensory detail
             carry the whole scene.
Paragraph 2: A small, gentle moment of choice or discovery appears — nothing scary, nothing
             loud. It connects naturally to the theme.
Paragraph 3: The characters move through it. The theme shows in a concrete action or decision;
             the moment resolves with a quiet sense of rightness.
Paragraph 4: The world settles. Close with two or three gentle sentences that wind the story
             down and end on the feeling the character is left with — not a stated lesson.
```

**5 paragraphs (5-min story):**
```
Paragraph 1: Ground us in the world with the characters present. Let one sensory detail
             carry the whole scene.
Paragraph 2: A small, gentle moment of choice or discovery appears — nothing scary, nothing
             loud. It connects naturally to the theme.
Paragraph 3: The characters explore or try things. Each character's personality comes through
             in what they do; let the story breathe here.
Paragraph 4: Something shifts. The theme lands in a concrete action or decision that feels
             earned — not announced.
Paragraph 5: The world settles. Close with two or three gentle sentences that wind the story
             down and end on the feeling the character is left with — not a stated lesson.
```

---

## 5. Known Problems

### Problem 1 — Location monotony
Even with 16 real-world settings, Claude gravitates toward the same specific sub-locations on repeated generations. "Scottish Highlands" reliably produces the same glen or loch. "Japanese countryside" reliably produces the same cherry-blossom path. The avoid-list mechanism exists but only prevents exact location name repeats — it doesn't break the gravitational pull toward the most-probable place within a region.

### Problem 2 — Theme execution sameness
The same theme + similar character types produce structurally near-identical stories across separate generations. "Kindness" stories almost always involve one character dropping something and another picking it up. "Bravery" stories almost always involve crossing a bridge or climbing something. The `THEME_STORY_SEED` seeds are single sentences — they define one plot hook per theme, which means every kindness story starts from the same premise and converges on similar resolutions.

### Problem 3 — Repetitive phrasing
Certain phrases recur even without repetitive inputs:
- **Truck characters:** "the engine ticked as it cooled", "the big wheels rolled slowly"
- **Opening beats:** "the smell of [local food] drifted through the air" as paragraph 1's sensory anchor
- **Transitions:** even after loosening STORY_ARC from rigid labels, Claude still uses "soon" and "before long" as paragraph-to-paragraph connectors
- **Closing beats:** endings converge on the character sitting/lying down and feeling something warm or quiet

The existing `NEVER use` list in LANGUAGE & TONE blocks the most egregious clichés, but adding more phrases risks over-constraining the prose and producing unnatural avoidance patterns.

---

## 6. Questions — What I'd Like You to Help Refine

Please work through each question and produce concrete revised prompt text I can paste back into the application.

**Q1 — Richer story seeds per theme**  
Each theme currently has one seed. How should we expand or restructure `THEME_STORY_SEED` so the same theme can produce meaningfully different stories across multiple generations? Options might include: a pool of 2–3 seeds per theme the prompt selects from, a seed that has enough internal ambiguity to branch differently, or a different seeding mechanism entirely.

**Q2 — Breaking location gravity**  
The setting instruction currently asks Claude to "choose a specific named village, neighborhood, market, or natural landmark within this region." This phrasing reliably produces the most statistically probable choice. What wording, or what additional instruction, would encourage Claude to range more widely across a region — picking less-expected but still authentic places? Consider whether an explicit list of place-type options helps, or whether the instruction itself should change.

**Q3 — Structural variety without losing the arc**  
The STORY_ARC templates give each paragraph a positional job. This prevents structural chaos but produces predictable story shapes (setup → problem → resolution → wind-down, every time). What changes to the templates — or what alternative approach — would allow the story shape itself to vary (e.g., a story that opens in the middle of action, or one where the resolution comes earlier and the final paragraphs linger) while still being appropriate for ages 2–5?

**Q4 — Reducing phrasing repetition without a banned-word list**  
We want to avoid the banned-word-list approach because it constrains variety and produces unnatural avoidance patterns. What prompt techniques would reduce mechanical phrasing (especially for Truck characters and opening-paragraph sensory beats) through positive instruction rather than prohibition? Consider: persona or voice anchors, prose style descriptors, sentence-variety instructions, or something else.

**Q5 — Prose style injection**  
Should the prompt inject a randomised prose style marker per generation — e.g. one of "spare and quiet", "warm and lyrical", "playful and bouncy" — to give each story a distinct voice? If so, where in the prompt should it live, how should it be worded, and are there risks to managing it for a 2–5 age range?

**Q6 — Anything else**  
Based on the full prompt above, are there other structural or wording changes you'd recommend that we haven't identified? Please flag anything that looks like a likely source of repetition or missed variety.

---

## 7. Hard Constraints — Do Not Change These

Any revised prompt must preserve:

- **Output format:** line 1 = title, line 2 = location, line 3 = blank, then paragraphs separated by blank lines. The server splits on `\n\n` to produce story pages — any deviation breaks the app.
- **Age appropriateness:** no fear, no villains, no violence, gentle tone throughout.
- **Paragraph count:** exactly 3, 4, or 5 paragraphs depending on length selection.
- **Word count targets:** ~150 / ~300 / ~500 words by length.
- **Location on line 2 only:** Claude must not repeat or restate the location anywhere in the story body.
- **No structural markers inside the story body:** no headers, bold text, labels, or bullet points in the paragraphs.
- **Character coverage:** every user-supplied character must appear and act in the story.
