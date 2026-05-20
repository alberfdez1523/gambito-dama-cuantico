import { motion } from 'framer-motion'
import type { Language } from '../lib/types'
import { ui } from '../lib/i18n'

interface OnlineBetaBadgeProps {
  language: Language
  className?: string
}

export function OnlineBetaBadge({ language, className = '' }: OnlineBetaBadgeProps) {
  const t = ui(language)
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border border-amber-500/35 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 ${className}`}
    >
      {t.onlineBetaBadge}
    </span>
  )
}

interface OnlineBetaNoticeProps {
  language: Language
  variant?: 'banner' | 'compact'
}

export default function OnlineBetaNotice({ language, variant = 'banner' }: OnlineBetaNoticeProps) {
  const t = ui(language)

  if (variant === 'compact') {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-ui-xs leading-relaxed text-amber-200/90">
        <OnlineBetaBadge language={language} />
        <span>{t.onlineBetaNotice}</span>
      </p>
    )
  }

  return (
    <motion.div
      className="rounded border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-ui-sm leading-relaxed text-amber-100/90"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <motion.div className="flex items-start gap-2.5">
        <OnlineBetaBadge language={language} className="mt-0.5" />
        <span>{t.onlineBetaNotice}</span>
      </motion.div>
    </motion.div>
  )
}
