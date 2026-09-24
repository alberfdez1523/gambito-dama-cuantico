#!/usr/bin/env node
// Falla si la entrada inicial (JS + CSS de index) supera el presupuesto de
// PRODUCT.md: "entrada inicial comprimida < 150 kB".
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 150)
const assetsDir = new URL('../frontend/dist/assets/', import.meta.url)

let entries
try {
  entries = readdirSync(assetsDir).filter((name) => /^index-[\w-]+\.(js|css)$/.test(name))
} catch {
  console.error('frontend/dist/assets no existe: ejecuta `npm run build` antes.')
  process.exit(1)
}
if (entries.length === 0) {
  console.error('No se encontraron archivos index-*.js/css en frontend/dist/assets.')
  process.exit(1)
}

let totalBytes = 0
for (const name of entries) {
  const size = gzipSync(readFileSync(join(assetsDir.pathname, name)), { level: 9 }).length
  totalBytes += size
  console.log(`${name.padEnd(32)} ${(size / 1024).toFixed(1)} kB gzip`)
}
const totalKb = totalBytes / 1024
console.log(`Entrada inicial: ${totalKb.toFixed(1)} kB gzip (presupuesto ${BUDGET_KB} kB)`)
if (totalKb > BUDGET_KB) {
  console.error('La entrada inicial supera el presupuesto de rendimiento.')
  process.exit(1)
}
