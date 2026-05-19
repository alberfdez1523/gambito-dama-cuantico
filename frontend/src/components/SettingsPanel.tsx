import { motion, AnimatePresence } from 'framer-motion'
import type { Language } from '../lib/types'
import type { AppSettings, Theme } from '../lib/settings'
import type { SettingsChangeMeta } from '../lib/themeTransition'
import { ui } from '../lib/i18n'
import { useModalA11y } from '../hooks/useModalA11y'

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
  const { containerRef, onBackdropClick } = useModalA11y(open, onClose, true)
  const titleId = 'settings-panel-title'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onBackdropClick}
          role="presentation"
        >
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-t-xl border border-surface-4 bg-surface-1 p-6 sm:rounded-xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 id={titleId} className="font-serif text-xl text-white">
                {t.settingsTitle}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] rounded px-3 text-xs text-neutral-500 transition-colors hover:bg-surface-2 hover:text-white"
              >
                {t.close}
              </button>
            </div>

            <div className="space-y-6">
              <SettingRow label={t.theme}>
                <div className="flex overflow-hidden rounded border border-surface-4">
                  {(['dark', 'light'] as Theme[]).map((theme, i) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={(e) =>
                        onChange(
                          { theme },
                          { themeOrigin: { x: e.clientX, y: e.clientY } },
                        )
                      }
                      className={`min-h-[44px] flex-1 px-4 text-xs font-semibold transition-colors
                        ${i > 0 ? 'border-l border-surface-4' : ''}
                        ${settings.theme === theme
                          ? 'bg-accent/10 text-accent'
                          : 'text-neutral-500 hover:bg-surface-2'
                        }`}
                    >
                      {theme === 'dark' ? t.themeDark : t.themeLight}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow label={t.language}>
                <div className="flex overflow-hidden rounded border border-surface-4">
                  {(['es', 'en'] as Language[]).map((lang, i) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => onChange({ language: lang })}
                      className={`min-h-[44px] flex-1 px-4 text-xs font-semibold transition-colors
                        ${i > 0 ? 'border-l border-surface-4' : ''}
                        ${settings.language === lang
                          ? 'bg-accent/10 text-accent'
                          : 'text-neutral-500 hover:bg-surface-2'
                        }`}
                    >
                      {lang === 'es' ? 'Español' : 'English'}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow label={t.sfxVolume}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.sfxVolume}
                  onChange={(e) => onChange({ sfxVolume: parseFloat(e.target.value) })}
                  className="h-1 w-full cursor-pointer appearance-none bg-surface-4
                    [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-accent"
                />
              </SettingRow>

              <SettingRow label={t.musicVolume}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.musicVolume}
                  onChange={(e) => onChange({ musicVolume: parseFloat(e.target.value) })}
                  className="h-1 w-full cursor-pointer appearance-none bg-surface-4
                    [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-accent"
                />
              </SettingRow>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
        {label}
      </p>
      {children}
    </div>
  )
}
