// Извлекает английские словари namespace-ов из установленной сборки DSH (app.asar).
// Пишет <outDir>/<namespace>.json — формат, который понимает check.mjs --reference.
const fs = require('fs')
const path = require('path')

const asarPath = process.argv[2]
const outDir = process.argv[3]

const buf = fs.readFileSync(asarPath)
const headerSize = buf.readUInt32LE(4)
const jsonLen = buf.readUInt32LE(12)
const header = JSON.parse(buf.slice(16, 16 + jsonLen).toString('utf8'))
const dataStart = 8 + headerSize

const entries = []
;(function walk(node, prefix) {
  for (const [name, item] of Object.entries(node.files || {})) {
    const p = prefix ? prefix + '/' + name : name
    if (item.files) walk(item, p)
    else entries.push({ path: p, offset: Number(item.offset), size: Number(item.size) })
  }
})(header, '')

const readEntry = (e) => buf.slice(dataStart + e.offset, dataStart + e.offset + e.size).toString('utf8')

function sliceBalanced(source, start) {
  const open = source[start]
  if (open !== '{' && open !== '[') return null
  const stack = [open]
  let inString = null
  for (let i = start + 1; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (ch === '\\') { i++; continue }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue }
    if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') {
      stack.pop()
      if (stack.length === 0) return source.slice(start, i + 1)
    }
  }
  return null
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Собирает объявления модуля (строковые и объектные/массивные литералы) и вычисляет их
// кумулятивно: каждая следующая декларация видит уже вычисленные предыдущие.
function collectVars(source) {
  const decls = []
  const seen = new Set()
  const declRe = /(?:^|[;\s])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g
  let m
  while ((m = declRe.exec(source))) {
    const name = m[1]
    if (seen.has(name)) continue
    let i = m.index + m[0].length
    while (i < source.length && /\s/.test(source[i])) i++
    const ch = source[i]
    let rhs = null
    if (ch === '{' || ch === '[') rhs = sliceBalanced(source, i)
    else if (ch === '"' || ch === "'") {
      const end = source.indexOf(ch, i + 1)
      if (end !== -1) rhs = source.slice(i, end + 1)
    }
    if (!rhs) continue
    seen.add(name)
    decls.push({ name, rhs })
  }
  const vars = new Map()
  let scope = ''
  for (let pass = 0; pass < 4; pass++) {
    let progress = false
    for (const { name, rhs } of decls) {
      if (vars.has(name)) continue
      try {
        const value = Function('"use strict";' + scope + 'return (' + rhs + ')')()
        vars.set(name, value)
        scope += 'const ' + name + ' = (' + rhs + ');'
        progress = true
      } catch { /* ждём следующего прохода */ }
    }
    if (!progress) break
  }
  return vars
}

function dictFromWrapper(wrapperText, vars) {
  // wrapper: { zh, en } | { zh: X, en: Y } — нужен en
  const m = /[{,]\s*en\s*:\s*([^,}]+)/.exec(wrapperText)
  if (m) {
    const token = m[1].trim()
    if (token.startsWith('{')) {
      try { return Function('"use strict"; return (' + token + ')')() } catch { return null }
    }
    if (vars.has(token)) return vars.get(token)
    return null
  }
  if (/[{,]\s*en\s*[,}]/.test(wrapperText)) return vars.get('en') ?? null
  return null
}

const results = new Map()
const problems = []
fs.mkdirSync(outDir, { recursive: true })

const candidates = entries.filter((e) => /\/lib\/[^/]+\.js$/.test(e.path) && readEntry(e).includes('locale.register'))

for (const entry of candidates) {
  const source = readEntry(entry)
  const vars = collectVars(source)
  let from = 0
  let found = 0
  while (true) {
    const at = source.indexOf('locale.register(', from)
    if (at === -1) break
    from = at + 1
    const start = at + 'locale.register('.length
    const rest = source.slice(start)
    const m2 = /^\s*("[^"]+"|'[^']+'|[A-Za-z_$][\w$]*)\s*,\s*("[^"]+"|'[^']+'|[A-Za-z_$][\w$]*)\s*,/.exec(rest)
    const m1 = /^\s*("[^"]+"|'[^']+'|[A-Za-z_$][\w$]*)\s*,/.exec(rest)

    let namespace = null
    let dict = null

    if (m2) {
      // трёхаргументная форма: register(ns, locale, dict)
      const nsTok = m2[1]
      const localeTok = m2[2]
      const nsName = /^["']/.test(nsTok) ? nsTok.slice(1, -1) : nsTok
      const localeId = /^["']/.test(localeTok) ? localeTok.slice(1, -1) : null
      if (localeId === 'en') {
        // ищем цикл, из которого берётся словарь
        const tail = rest.slice(m2[0].length)
        const dictVar = /^([A-Za-z_$][\w$]*)/.exec(tail)?.[1]
        if (dictVar && vars.has(dictVar)) {
          dict = vars.get(dictVar)
          if (!/^["']/.test(nsTok) && vars.has(nsName)) namespace = vars.get(nsName)
          else namespace = nsName
        } else {
          problems.push(`${entry.path}: 3-arg register, unknown dict var "${dictVar}" for ${nsName}`)
        }
      }
    }

    if (!dict && m1) {
      const tok = m1[1]
      namespace = /^["']/.test(tok) ? tok.slice(1, -1) : vars.has(tok) ? vars.get(tok) : null
      let i = start + m1[0].length
      while (i < source.length && /\s/.test(source[i])) i++
      if (namespace && source[i] === '{') {
        const wrapper = sliceBalanced(source, i)
        if (wrapper) dict = dictFromWrapper(wrapper, vars)
      }
      if (dict && !namespace) problems.push(`${entry.path}: namespace not resolved (${tok})`)
      if (!dict && namespace) problems.push(`${entry.path}: en dictionary not found for ${namespace}`)
    }

    if (!namespace || !dict) continue
    if (results.has(namespace)) Object.assign(results.get(namespace), dict)
    else results.set(namespace, dict)
    found++
  }
  if (!found) problems.push(`${entry.path}: no dictionaries extracted`)
}

let totalKeys = 0
for (const [namespace, dict] of [...results].sort(([a], [b]) => a.localeCompare(b))) {
  const keys = Object.keys(dict)
  totalKeys += keys.length
  fs.writeFileSync(path.join(outDir, namespace + '.json'), JSON.stringify(dict, null, 2) + '\n')
}

console.log(`файлов-кандидатов: ${candidates.length}`)
console.log(`namespace'ов: ${results.size}, строк: ${totalKeys}`)
const uniqueProblems = [...new Set(problems)]
if (uniqueProblems.length) {
  console.log(`проблем (${uniqueProblems.length}):`)
  for (const p of uniqueProblems.slice(0, 40)) console.log(' -', p)
}
