import styles from './CharacterCard.module.css'

const TYPE_EMOJI = {
  Human: '👧',
  Animal: '🐾',
  Truck: '🚛',
  'Fantasy Creature': '🦄',
  Other: '✨',
}

export default function CharacterCard({ character, onRemove }) {
  const emoji = TYPE_EMOJI[character.type] || '⭐'
  const description = character.subtype
    ? `${character.subtype} · ${character.trait}`
    : `${character.type} · ${character.trait}`

  return (
    <div className={styles.card}>
      <span className={styles.emoji} aria-hidden="true">{emoji}</span>
      <div className={styles.info}>
        <span className={styles.name}>{character.name}</span>
        <span className={styles.desc}>{description}</span>
        {character.appearance && (
          <span className={styles.appearance}>{character.appearance}</span>
        )}
      </div>
      <button
        className={styles.remove}
        onClick={() => onRemove(character.id)}
        aria-label={`Remove ${character.name}`}
        type="button"
      >
        ×
      </button>
    </div>
  )
}
