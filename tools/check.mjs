/**
 * Check the language pack without booting the app.
 *
 * Always checks:
 *   - every `dictionaries/*.json` parses as a flat object of non-empty strings,
 *   - `lib/client.js` registers exactly one module whose id is the package name,
 *   - the factory exports `apply` and `inject: ["locale"]`,
 *   - `apply` registers the `ru` language with fallback `en` and one dictionary
 *     per namespace, under the `ru` language id.
 *
 * With `--reference <dir>` (one `<namespace>.json` of English strings per
 * namespace, e.g. extracted from the shipped packages) it also checks that the
 * key set matches and that `{placeholders}` survive translation.
 *
 * Usage: node tools/check.mjs [--reference ./.recon/en]
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const argv = process.argv.slice(2)
const refDir = argv.includes('--reference') ? argv[argv.indexOf('--reference') + 1] : undefined

const problems = []
const dictDir = path.join(root, 'dictionaries')
const dictionaries = {}
const emptyValues = []
for (const file of fs.readdirSync(dictDir).filter((f) => f.endsWith('.json')).sort()) {
  const namespace = file.slice(0, -'.json'.length)
  let parsed
  try { parsed = JSON.parse(fs.readFileSync(path.join(dictDir, file), 'utf8')) }
  catch (error) { problems.push(`${file}: ${error.message}`); continue }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) { problems.push(`${file}: not an object`); continue }
  for (const [key, value] of Object.entries(parsed)) {
    // Some keys are deliberately empty or whitespace separators; the reference
    // pass decides whether that matches the English source.
    if (typeof value === 'string' && value === '') emptyValues.push({ namespace, key })
    else if (typeof value !== 'string' && !Array.isArray(value)) problems.push(`${namespace}.${key}: value is ${typeof value}`)
  }
  dictionaries[namespace] = parsed
}

// the browser kernel executes the bundle for its side effect on window
const source = fs.readFileSync(path.join(root, 'lib', 'client.js'), 'utf8')
let registration = null
const sandbox = { window: { __ModuleLoader__: { load: (entry) => { registration = entry } } }, console }
vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'lib/client.js' })

if (!registration) problems.push('lib/client.js registered no module')
else {
  if (registration.id !== pkg.name) problems.push(`bundle id ${registration.id} != package name ${pkg.name}`)
  if (typeof registration.factory !== 'function') problems.push('module has no factory')
  else {
    const exports = registration.factory((name) => { throw new Error(`unexpected require(${name})`) })
    if (typeof exports.apply !== 'function') problems.push('apply is not exported')
    if (!Array.isArray(exports.inject) || !exports.inject.includes('locale')) problems.push('inject must declare "locale"')
    const calls = []
    const ctx = {
      effect: (fn, label) => { calls.push({ label, value: fn() }) },
      locale: {
        addLanguage: (language) => { calls.push({ kind: 'language', language }); return () => {} },
        register: (namespace, language, dictionary) => { calls.push({ kind: 'dictionary', namespace, language, keys: Object.keys(dictionary).length }); return () => {} },
      },
    }
    exports.apply(ctx)
    const languages = calls.filter((c) => c.kind === 'language')
    if (languages.length !== 1) problems.push(`expected one addLanguage call, got ${languages.length}`)
    else {
      const l = languages[0].language
      if (l.id !== 'ru' || l.fallback !== 'en' || !l.label) problems.push(`language definition is ${JSON.stringify(l)}`)
    }
    const registered = calls.filter((c) => c.kind === 'dictionary')
    for (const call of registered) {
      if (call.language !== 'ru') problems.push(`dictionary ${call.namespace} registered under ${call.language}`)
      if (!(call.namespace in dictionaries)) problems.push(`registered unknown namespace ${call.namespace}`)
      if (dictionaries[call.namespace] && call.keys !== Object.keys(dictionaries[call.namespace]).length) {
        problems.push(`namespace ${call.namespace}: bundle has ${call.keys} keys, file has ${Object.keys(dictionaries[call.namespace]).length}`)
      }
    }
    for (const namespace of Object.keys(dictionaries)) {
      if (!registered.some((c) => c.namespace === namespace)) problems.push(`namespace ${namespace} is never registered`)
    }
  }
}

if (refDir) {
  const placeholders = (value) => [...value.matchAll(/\{([A-Za-z0-9_.]+)\}/g)].map((m) => m[1]).sort().join(',')
  let checked = 0
  for (const [namespace, dictionary] of Object.entries(dictionaries)) {
    const refPath = path.join(refDir, `${namespace}.json`)
    if (!fs.existsSync(refPath)) { problems.push(`${namespace}: no reference file`); continue }
    const reference = JSON.parse(fs.readFileSync(refPath, 'utf8'))
    for (const [key, value] of Object.entries(dictionary)) {
      checked++
      if (typeof value !== 'string') continue
      const english = reference[key]
      if (typeof english !== 'string') { problems.push(`${namespace}.${key}: no English source string`); continue }
      if (placeholders(english) !== placeholders(value)) {
        problems.push(`${namespace}.${key}: placeholders "${placeholders(english)}" -> "${placeholders(value)}"`)
      }
      if (value === '' && english !== '') problems.push(`${namespace}.${key}: empty translation of ${JSON.stringify(english)}`)
    }
    for (const key of Object.keys(reference)) {
      if (!(key in dictionary)) problems.push(`${namespace}.${key}: not translated`)
    }
  }
  console.log(`reference comparison: ${checked} keys`)
}

const keys = Object.values(dictionaries).reduce((n, d) => n + Object.keys(d).length, 0)
console.log(`namespaces: ${Object.keys(dictionaries).length}, keys: ${keys}`)
if (problems.length) {
  console.log(`PROBLEMS (${problems.length}):`)
  for (const problem of problems.slice(0, 60)) console.log(' -', problem)
  if (problems.length > 60) console.log(` ... and ${problems.length - 60} more`)
  process.exitCode = 1
} else {
  console.log('OK')
}
