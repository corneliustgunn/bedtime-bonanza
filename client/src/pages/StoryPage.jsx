import { useLocation, Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Header from '../components/Header.jsx'
import StoryDisplay from '../components/StoryDisplay.jsx'
import styles from './StoryPage.module.css'

export default function StoryPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const story = state?.story

  useEffect(() => {
    if (!story) {
      navigate('/', { replace: true })
    }
  }, [story, navigate])

  if (!story) return null

  return (
    <div className="page">
      <div className="container">
        <Header />

        <main className={styles.main}>
          <StoryDisplay title={story.title} pages={story.pages} />

          <div className={styles.actions}>
            <Link to="/build" className="btn btn-secondary">
              Build another story
            </Link>
            <Link to="/" className="btn btn-ghost">
              Home
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
}
