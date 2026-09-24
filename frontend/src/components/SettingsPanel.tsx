import { AnimatePresence, m } from 'framer-motion'
import type { Language } from '../lib/types'
import type {
  AppSettings,
  BoardStyle,
  MotionPreference,
  PieceStyle,
  ScreenReaderNarration,
  Theme,
} from '../lib/settings'
import type { SettingsChangeMeta } from '../lib/themeTransition'
import { ui } from '../lib/i18n'
import { useModalA11y } from '../hooks/useModalA11y'
import GameIcon from './GameIcon'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  settings: AppSettings
  onChange: (partial: Partial<AppSettings>, meta?: SettingsChangeMeta) => void
  language: Language
}

export default function SettingsPanel({
  open,
  onClose,
  settings,
  onChange,
  language,
}: SettingsPanelProps) {
  const t = ui(language)
  const es = language === 'es'
  const { containerRef, onBackdropClick } = useModalA11y(open, onClose, true)
  const titleId = 'settings-panel-title'

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 sm:items-center sm:px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onBackdropClick}
          role="presentation"
        >
          <m.section
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-surface-1 px-5 pb-8 pt-5 shadow-card sm:rounded-xl sm:px-7"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mb-7 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent">
                  <GameIcon name="settings" className="h-5 w-5" />
                </span>
                <div>
                  <h2 id={titleId} className="text-lg font-semibold text-white">
                    {t.settingsTitle}
                  </h2>
                  <p className="text-ui-xs text-neutral-500">
                    {es ? 'Apariencia, sonido y ayudas' : 'Appearance, sound, and hints'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-lg px-3 text-ui-sm font-medium text-neutral-500 hover:bg-surface-2 hover:text-white"
              >
                {t.close}
              </button>
            </header>

            <div className="space-y-7">
              <ChoiceGroup
                id="settings-theme"
                label={t.theme}
                value={settings.theme}
                options={[
                  { value: 'system', label: es ? 'Sistema' : 'System' },
                  { value: 'dark', label: t.themeDark },
                  { value: 'light', label: t.themeLight },
                ]}
                onChange={(theme, event) =>
                  onChange(
                    { theme: theme as Theme },
                    { themeOrigin: { x: event.clientX, y: event.clientY } },
                  )
                }
              />

              <ChoiceGroup
                id="settings-motion"
                label={es ? 'Movimiento' : 'Motion'}
                value={settings.motionPreference}
                options={[
                  { value: 'system', label: es ? 'Sistema' : 'System' },
                  { value: 'reduced', label: es ? 'Reducido' : 'Reduced' },
                  { value: 'full', label: es ? 'Completo' : 'Full' },
                ]}
                onChange={(value) => onChange({ motionPreference: value as MotionPreference })}
              />

              <ChoiceGroup
                id="settings-board"
                label={es ? 'Tablero' : 'Board'}
                value={settings.boardStyle}
                options={[
                  { value: 'editorial', label: es ? 'Editorial' : 'Editorial' },
                  { value: 'walnut', label: es ? 'Nogal' : 'Walnut' },
                  { value: 'contrast', label: es ? 'Contraste' : 'Contrast' },
                ]}
                onChange={(value) => onChange({ boardStyle: value as BoardStyle })}
              />

              <ChoiceGroup
                id="settings-pieces"
                label={es ? 'Piezas' : 'Pieces'}
                value={settings.pieceStyle}
                options={[
                  { value: 'solid', label: es ? 'Sólidas' : 'Solid' },
                  { value: 'outline', label: es ? 'Contorno' : 'Outline' },
                ]}
                onChange={(value) => onChange({ pieceStyle: value as PieceStyle })}
              />

              <ChoiceGroup
                id="settings-narration"
                label={es ? 'Narración del lector de pantalla' : 'Screen reader narration'}
                value={settings.screenReaderNarration}
                options={[
                  { value: 'concise', label: es ? 'Concisa' : 'Concise' },
                  { value: 'detailed', label: es ? 'Detallada' : 'Detailed' },
                ]}
                onChange={(value) => onChange({ screenReaderNarration: value as ScreenReaderNarration })}
              />

              <ChoiceGroup
                id="settings-language"
                label={t.language}
                value={settings.language}
                options={[
                  { value: 'es', label: 'Español' },
                  { value: 'en', label: 'English' },
                ]}
                onChange={(nextLanguage) => onChange({ language: nextLanguage as Language })}
              />

              <RangeSetting
                id="sfx-volume"
                label={t.sfxVolume}
                value={settings.sfxVolume}
                onChange={(sfxVolume) => onChange({ sfxVolume })}
              />

              <RangeSetting
                id="music-volume"
                label={t.musicVolume}
                value={settings.musicVolume}
                onChange={(musicVolume) => onChange({ musicVolume })}
              />

              <div className="divide-y divide-line/70 border-y border-line/70">
                <SwitchSetting
                  label={es ? 'Alto contraste' : 'High contrast'}
                  description={es ? 'Refuerza bordes, estados y separación entre superficies.' : 'Strengthens borders, states, and surface separation.'}
                  checked={settings.highContrast}
                  onChange={(highContrast) => onChange({ highContrast })}
                />
                <SwitchSetting
                  label={es ? 'Ayudas contextuales' : 'Contextual hints'}
                  description={es ? 'Explica acciones cuánticas al seleccionar una pieza.' : 'Explains quantum actions when a piece is selected.'}
                  checked={settings.showHints}
                  onChange={(showHints) => onChange({ showHints })}
                />
                <SwitchSetting
                  label={es ? 'Resolver mediciones automáticamente' : 'Auto-resolve measurements'}
                  description={es ? 'Omite el giro manual de la ruleta cuando juegas.' : 'Skips the manual roulette spin while playing.'}
                  checked={settings.autoResolveMeasurements}
                  onChange={(autoResolveMeasurements) => onChange({ autoResolveMeasurements })}
                />
                <SwitchSetting
                  label={es ? 'Vibración' : 'Haptics'}
                  description={es ? 'Señales opcionales en movimiento, captura y medición compatibles.' : 'Optional cues for moves, captures, and measurements on supported devices.'}
                  checked={settings.haptics}
                  onChange={(haptics) => onChange({ haptics })}
                />
                <SwitchSetting
                  label={es ? 'Analítica anónima' : 'Anonymous analytics'}
                  description={es ? 'Solo ruta, concepto, duración, puntuación y nivel de pista. Nunca tableros completos.' : 'Only route, concept, duration, score, and hint level. Never full board states.'}
                  checked={settings.telemetryConsent}
                  onChange={(telemetryConsent) => onChange({ telemetryConsent })}
                />
              </div>
            </div>
          </m.section>
        </m.div>
      )}
    </AnimatePresence>
  )
}

function ChoiceGroup({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string, event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <fieldset>
      <legend id={`${id}-label`} className="mb-2 text-ui-sm font-semibold text-neutral-300">
        {label}
      </legend>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex rounded-lg bg-surface-2 p-1">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={(event) => onChange(option.value, event)}
              className={`min-h-[44px] flex-1 rounded-md px-4 text-ui-sm font-semibold ${
                selected
                  ? 'bg-surface-0 text-accent shadow-subtle'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function RangeSetting({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const percent = Math.round(value * 100)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-ui-sm font-semibold text-neutral-300">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-ui-xs text-neutral-500">
          {percent}%
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        aria-valuetext={`${percent}%`}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer appearance-none bg-transparent accent-accent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-surface-4 [&::-webkit-slider-thumb]:mt-[-7px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
      />
    </div>
  )
}

function SwitchSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-5 py-4">
      <div>
        <p className="text-ui-sm font-semibold text-neutral-300">{label}</p>
        <p className="mt-1 text-ui-xs leading-relaxed text-neutral-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full p-1 ${checked ? 'bg-quantum' : 'bg-surface-4'}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white transition-transform duration-150 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
