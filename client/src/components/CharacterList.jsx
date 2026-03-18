import { useState } from 'react'
import CharacterCard from './CharacterCard.jsx'
import CharacterForm from './CharacterForm.jsx'
import styles from './CharacterList.module.css'

const MAX_CHARACTERS = 4

export default function CharacterList({ characters, onChange }) {
  const [showForm, setShowForm] = useState(characters.length === 0)

  function handleAdd(character) {
    const next = [...characters, character]
    onChange(next)
    if (next.length >= MAX_CHARACTERS) {
      setShowForm(false)
    }
  }

  function handleRemove(id) {
    onChange(characters.filter((c) => c.id !== id))
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.list}>
        {characters.map((c) => (
          <CharacterCard key={c.id} character={c} onRemove={handleRemove} />
        ))}
      </div>

      {showForm ? (
        <CharacterForm
          onAdd={handleAdd}
          onCancel={() => setShowForm(false)}
          showCancel={characters.length > 0}
        />
      ) : characters.length < MAX_CHARACTERS ? (
        <button
          type="button"
          className={`btn btn-ghost ${styles.addBtn}`}
          onClick={() => setShowForm(true)}
        >
          + Add another character
        </button>
      ) : (
        <p className={styles.maxNote}>Maximum 4 characters reached</p>
      )}
    </div>
  )
}
