import { useState } from 'react'
import styles from './CharacterForm.module.css'

const CHARACTER_TYPES = ['Human', 'Animal', 'Fantasy Creature', 'Robot', 'Fairy', 'Dragon', 'Talking Object']
const TRAITS = ['Brave', 'Curious', 'Kind', 'Funny', 'Shy', 'Adventurous', 'Gentle', 'Playful']

const SUBTYPE_PLACEHOLDER = {
  Animal: 'e.g. bunny, elephant, fox',
  'Fantasy Creature': 'e.g. unicorn, phoenix, sprite',
  'Talking Object': 'e.g. teapot, lantern, book',
  Fairy: 'e.g. flower fairy, moon fairy',
  Dragon: 'e.g. little fire dragon, cloud dragon',
}

export default function CharacterForm({ onAdd, onCancel, showCancel }) {
  const [form, setForm] = useState({ name: '', type: 'Human', subtype: '', appearance: '', trait: 'Kind' })
  const [error, setError] = useState('')

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const needsSubtype = ['Animal', 'Fantasy Creature', 'Talking Object', 'Fairy', 'Dragon'].includes(form.type)

  function handleSubmit() {
    if (!form.name.trim()) {
      setError('Please give your character a name.')
      return
    }
    if (needsSubtype && !form.subtype.trim()) {
      setError(`Please describe what kind of ${form.type.toLowerCase()} this is.`)
      return
    }
    setError('')
    onAdd({ ...form, id: crypto.randomUUID() })
    setForm({ name: '', type: 'Human', subtype: '', appearance: '', trait: 'Kind' })
  }

  return (
    <div className={styles.form}>
      <div className={styles.row}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="char-name">Name</label>
          <input
            id="char-name"
            className="form-input"
            type="text"
            placeholder="e.g. Luna, Kofi, Mia"
            value={form.name}
            onChange={set('name')}
            maxLength={30}
          />
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="char-type">Type</label>
          <div className="select-wrapper">
            <select id="char-type" className="form-select" value={form.type} onChange={set('type')}>
              {CHARACTER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {needsSubtype && (
        <div className="form-group">
          <label className="form-label" htmlFor="char-subtype">
            {form.type === 'Talking Object' ? 'What object?' : `What kind of ${form.type.toLowerCase()}?`}
          </label>
          <input
            id="char-subtype"
            className="form-input"
            type="text"
            placeholder={SUBTYPE_PLACEHOLDER[form.type] || ''}
            value={form.subtype}
            onChange={set('subtype')}
            maxLength={40}
          />
        </div>
      )}

      <div className={styles.row}>
        <div className="form-group" style={{ flex: 2 }}>
          <label className="form-label" htmlFor="char-appearance">Appearance</label>
          <input
            id="char-appearance"
            className="form-input"
            type="text"
            placeholder="e.g. fluffy orange fur, sparkly blue wings"
            value={form.appearance}
            onChange={set('appearance')}
            maxLength={80}
          />
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="char-trait">Personality</label>
          <div className="select-wrapper">
            <select id="char-trait" className="form-select" value={form.trait} onChange={set('trait')}>
              {TRAITS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        {showCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={handleSubmit}>
          + Add Character
        </button>
      </div>
    </div>
  )
}
