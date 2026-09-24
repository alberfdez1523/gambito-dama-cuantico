import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { AcademyProgressController } from '../hooks/useAcademyProgress'
import { getCourseCompletion } from '../lib/academyProgress'
import { apiFetch } from '../lib/api'
import { FEATURES } from '../lib/featureFlags'
import { isSupabaseConfigured } from '../lib/onlineConfig'
import type { Language } from '../lib/types'
import GameIcon from './GameIcon'
import QuantumLogo from './QuantumLogo'

interface ProfileScreenProps {
  language: Language
  academy: AcademyProgressController
  onBack: () => void
  onOpenSettings: () => void
}

export default function ProfileScreen({ language, academy, onBack, onOpenSettings }: ProfileScreenProps) {
  const es = language === 'es'
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const syncEnabled = FEATURES.accountSync
  const onlineAvailable = syncEnabled && isSupabaseConfigured()
  const linkedUser = user && !user.is_anonymous ? user : null
  const alias = useMemo(() => `Gambito-${academy.progress.guestId.slice(-5).toUpperCase()}`, [academy.progress.guestId])
  const completed = academy.progress.completedLessonIds.length
  const supporterCheckoutUrl = FEATURES.supporterMembership
    && /^https:\/\/(buy|checkout)\.stripe\.com\//.test(import.meta.env.VITE_SUPPORTER_CHECKOUT_URL ?? '')
    ? import.meta.env.VITE_SUPPORTER_CHECKOUT_URL
    : null

  useEffect(() => {
    if (!onlineAvailable) return undefined
    let active = true
    let unsubscribe: (() => void) | undefined
    void import('../lib/supabase').then(({ getSupabase }) => {
      if (!active) return
      const client = getSupabase()
      void client.auth.getUser().then(({ data }) => {
        if (active) setUser(data.user)
      })
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (!active) return
        const nextUser = session?.user ?? null
        setUser(nextUser)
        if (nextUser && !nextUser.is_anonymous) {
          if (localStorage.getItem('gdd-age13-confirmed') === 'true') {
            void client
              .from('profiles')
              .update({ age_13_confirmed: true, updated_at: new Date().toISOString() })
              .eq('id', nextUser.id)
          }
          void academy.syncNow()
        }
      })
      unsubscribe = () => data.subscription.unsubscribe()
    })
    return () => {
      active = false
      unsubscribe?.()
    }
    // Solo depende de la función estable de sincronización, no del objeto completo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academy.syncNow, onlineAvailable])

  const exportProgress = async () => {
    const payload = await academy.exportData()
    const blobUrl = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = `gambito-progreso-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(blobUrl)
  }

  const sendMagicLink = async () => {
    if (!onlineAvailable || !email || !ageConfirmed) return
    setAuthBusy(true)
    setAuthMessage('')
    localStorage.setItem('gdd-age13-confirmed', 'true')
    try {
      const { getSupabase } = await import('../lib/supabase')
      const { error } = await getSupabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/profile` },
      })
      if (error) throw error
      setAuthMessage(es ? 'Enlace enviado. Revisa tu correo.' : 'Link sent. Check your email.')
    } catch {
      setAuthMessage(es ? 'No se pudo enviar el enlace. Inténtalo de nuevo.' : 'The link could not be sent. Try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  const signInWithGoogle = async () => {
    if (!onlineAvailable || !ageConfirmed) return
    setAuthBusy(true)
    localStorage.setItem('gdd-age13-confirmed', 'true')
    try {
      const { getSupabase } = await import('../lib/supabase')
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/profile` },
      })
      if (error) throw error
    } catch {
      setAuthMessage(es ? 'No se pudo iniciar sesión con Google.' : 'Google sign-in could not start.')
      setAuthBusy(false)
    }
  }

  const signOut = async () => {
    const { getSupabase } = await import('../lib/supabase')
    await getSupabase().auth.signOut()
    setUser(null)
  }

  const deleteProgress = async () => {
    setAuthBusy(true)
    setAuthMessage('')
    try {
      if (linkedUser && onlineAvailable) {
        const { getSupabase } = await import('../lib/supabase')
        const client = getSupabase()
        const { data } = await client.auth.getSession()
        if (data.session) {
          const response = await apiFetch('/v1/profile', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          })
          if (!response.ok) throw new Error('DELETE_FAILED')
        }
        await client.auth.signOut()
        setUser(null)
      }
      await academy.resetProgress()
      setConfirmDelete(false)
    } catch {
      setAuthMessage(es ? 'No se pudo completar el borrado. No se han ocultado errores pendientes.' : 'Deletion could not be completed. Pending errors were not hidden.')
    } finally {
      setAuthBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-surface-0 pb-24 text-ink md:pb-12">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-0/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-7">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-secondary hover:text-ink">
            <GameIcon name="chevron" className="rotate-180" />
            {es ? 'Inicio' : 'Home'}
          </button>
          <div className="flex items-center gap-3">
            <QuantumLogo className="h-8 w-14" title={es ? 'Perfil' : 'Profile'} />
            <span className="font-semibold">{es ? 'Perfil y progreso' : 'Profile and progress'}</span>
          </div>
          <button type="button" onClick={onOpenSettings} className="grid min-h-11 min-w-11 place-items-center text-ink-secondary hover:text-ink" aria-label={es ? 'Ajustes' : 'Settings'}>
            <GameIcon name="settings" className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-9 sm:px-7 lg:py-12">
        <section className="grid gap-6 border-b border-line pb-9 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-quantum">{linkedUser ? (es ? 'Cuenta vinculada' : 'Linked account') : (es ? 'Invitado persistente' : 'Persistent guest')}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{linkedUser?.email ?? alias}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ink-secondary">
              {linkedUser
                ? (es ? 'Tu identidad está lista para sincronizar progreso entre dispositivos.' : 'Your identity is ready to sync progress across devices.')
                : (es ? 'Puedes aprender y jugar sin crear una cuenta. Vincúlala solo si quieres sincronizar.' : 'Learn and play without an account. Link it only if you want synchronisation.')}
            </p>
            <button
              type="button"
              onClick={() => void academy.syncNow()}
              disabled={!syncEnabled}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-ink-secondary hover:text-quantum disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                className={`h-2 w-2 rounded-full ${academy.syncState === 'synced' ? 'bg-emerald-400' : academy.syncState === 'error' ? 'bg-amber-400' : 'bg-ink-muted'}`}
                aria-hidden="true"
              />
              {!syncEnabled
                ? (es ? 'Sincronización desactivada en esta versión' : 'Sync disabled in this release')
                : academy.syncState === 'syncing'
                ? (es ? 'Sincronizando…' : 'Syncing…')
                : academy.syncState === 'offline'
                  ? (es ? 'Sin conexión · progreso protegido' : 'Offline · progress protected')
                  : academy.syncState === 'error'
                    ? (es ? 'Pendiente de sincronizar · reintentar' : 'Sync pending · retry')
                    : (es ? 'Progreso sincronizado' : 'Progress synced')}
            </button>
          </div>
          <div className="border-l-2 border-accent bg-accent/[0.05] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{es ? 'Identificador local' : 'Local identifier'}</p>
            <p className="mt-3 break-all font-mono text-xs text-ink-secondary">{academy.progress.guestId}</p>
          </div>
        </section>

        <section className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-4">
          <Metric label={es ? 'Actividades' : 'Activities'} value={completed} />
          <Metric label={es ? 'Ruta clásica' : 'Classic route'} value={`${getCourseCompletion(academy.progress, 'classic')}%`} />
          <Metric label={es ? 'Ruta cuántica' : 'Quantum route'} value={`${getCourseCompletion(academy.progress, 'quantum')}%`} />
          <Metric label={es ? 'Mejor racha' : 'Best streak'} value={academy.progress.longestStreak} />
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="border border-line bg-surface-1 p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{es ? 'Cuenta opcional' : 'Optional account'}</p>
                <h2 className="mt-3 text-2xl font-semibold">{linkedUser ? (es ? 'Sesión activa' : 'Signed in') : (es ? 'Sincroniza cuando quieras' : 'Sync when you want')}</h2>
              </div>
              <GameIcon name="user" className="h-6 w-6 text-quantum" />
            </div>

            {linkedUser ? (
              <div className="mt-6">
                <p className="text-sm text-ink-secondary">{linkedUser.email}</p>
                <button type="button" onClick={() => void signOut()} className="mt-5 min-h-11 border border-line px-4 text-sm font-semibold text-ink hover:border-ink">
                  {es ? 'Cerrar sesión' : 'Sign out'}
                </button>
              </div>
            ) : onlineAvailable ? (
              <div className="mt-6">
                <label className="block text-xs font-semibold text-ink-secondary" htmlFor="profile-email">Email</label>
                <input
                  id="profile-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  className="mt-2 min-h-12 w-full border border-line bg-surface-0 px-4 text-sm text-ink outline-none focus:border-quantum"
                />
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-5 text-ink-secondary">
                  <input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-indigo-500" />
                  <span>{es ? 'Confirmo que tengo 13 años o más. No guardamos tu fecha de nacimiento.' : 'I confirm I am 13 or older. We do not store your date of birth.'}</span>
                </label>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => void sendMagicLink()} disabled={!email || !ageConfirmed || authBusy} className="min-h-12 bg-quantum px-4 text-sm font-semibold text-on-quantum disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-muted">
                    {es ? 'Enviar enlace mágico' : 'Send magic link'}
                  </button>
                  <button type="button" onClick={() => void signInWithGoogle()} disabled={!ageConfirmed || authBusy} className="min-h-12 border border-line px-4 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40">
                    {es ? 'Continuar con Google' : 'Continue with Google'}
                  </button>
                </div>
                {authMessage && <p className="mt-4 text-xs leading-5 text-ink-secondary" role="status">{authMessage}</p>}
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-ink-secondary">
                {!syncEnabled
                  ? (es ? 'La vinculación de cuenta está desactivada por el flag de esta entrega. Todo el progreso local sigue disponible.' : 'Account linking is disabled by this release flag. All local progress remains available.')
                  : (es ? 'La conexión de cuenta aparecerá cuando Supabase esté configurado. Todo el progreso local sigue disponible.' : 'Account linking appears when Supabase is configured. All local progress remains available.')}
              </p>
            )}
          </section>

          <section className="border border-line bg-surface-1 p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{es ? 'Control de datos' : 'Data controls'}</p>
            <h2 className="mt-3 text-2xl font-semibold">{es ? 'Tus datos, portables' : 'Your data, portable'}</h2>
            <p className="mt-3 text-sm leading-6 text-ink-secondary">
              {es ? 'Exporta intentos, dominio, ajustes y replays en JSON. Con una cuenta vinculada, el borrado elimina también los datos sincronizados.' : 'Export attempts, mastery, settings, and replays as JSON. With a linked account, deletion also removes synced data.'}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => void exportProgress()} className="inline-flex min-h-12 items-center justify-center gap-2 border border-line px-4 text-sm font-semibold text-ink hover:border-quantum hover:text-quantum">
                <GameIcon name="download" />
                {es ? 'Exportar progreso' : 'Export progress'}
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex min-h-12 items-center justify-center gap-2 border border-red-400/30 px-4 text-sm font-semibold text-red-400 hover:border-red-400">
                <GameIcon name="trash" />
                {es ? 'Borrar progreso' : 'Delete progress'}
              </button>
            </div>
            {confirmDelete && (
              <div className="mt-5 border-l-2 border-red-400 bg-red-500/[0.06] p-4" role="alert">
                <p className="text-sm font-semibold">{linkedUser
                  ? (es ? 'Esta acción elimina tu progreso sincronizado, replays y datos locales.' : 'This deletes synced progress, replays, and local data.')
                  : (es ? 'Esta acción elimina el progreso y los replays locales de este dispositivo.' : 'This deletes local progress and replays from this device.')}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" disabled={authBusy} onClick={() => void deleteProgress()} className="min-h-11 bg-red-500 px-4 text-xs font-semibold text-white disabled:opacity-40">
                    {es ? 'Sí, borrar' : 'Yes, delete'}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 px-4 text-xs font-semibold text-ink-secondary hover:text-ink">
                    {es ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {supporterCheckoutUrl && (
          <section className="mt-6 grid gap-5 border border-accent/40 bg-accent/[0.05] p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{es ? 'Membresía de apoyo' : 'Supporter membership'}</p>
              <h2 className="mt-3 text-2xl font-semibold">{es ? 'Apoya una Academia abierta' : 'Support an open Academy'}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary">
                {es ? 'Incluye únicamente cosméticos accesibles y un distintivo de apoyo. Rutas, tutor, reglas, retos y juego competitivo siguen siendo gratuitos.' : 'Includes accessible cosmetics and a supporter badge only. Routes, coach, rules, challenges, and competitive play remain free.'}
              </p>
            </div>
            <a
              href={supporterCheckoutUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center border border-accent bg-accent px-5 text-sm font-semibold text-surface-0 hover:bg-accent-hover"
            >
              {es ? 'Abrir pago seguro' : 'Open secure checkout'}
            </a>
          </section>
        )}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-1 p-5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-ink-muted">{label}</p>
      <p className="mt-3 font-mono text-3xl font-semibold text-ink">{value}</p>
    </div>
  )
}
