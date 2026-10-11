/**
 * Generate `lib/client.js` from `dictionaries/*.json`.
 *
 * One file per locale namespace, named after the namespace it translates
 * (`settings.locale.json` -> `settings.locale`). Values are emitted verbatim;
 * a key that is absent here falls back to the shipped English dictionary of the
 * package that owns the namespace.
 *
 * Usage: node tools/build-client.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dictDir = path.join(root, 'dictionaries')
const outFile = path.join(root, 'lib', 'client.js')

const dictionaries = {}
for (const name of fs.readdirSync(dictDir).filter((f) => f.endsWith('.json')).sort()) {
  const namespace = name.slice(0, -'.json'.length)
  const parsed = JSON.parse(fs.readFileSync(path.join(dictDir, name), 'utf8'))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`${name}: expected a flat JSON object of key -> Russian text`)
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') continue
    // A few shipped keys carry arrays of strings (the agent-preset markdown guides).
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) continue
    throw new TypeError(`${name}: ${key} must be a string or an array of strings`)
  }
  dictionaries[namespace] = parsed
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const id = pkg.name

const body = `/**
 * Russian language pack for the DSH web GUI — GENERATED FILE.
 * Edit \`dictionaries/*.json\` and run \`node tools/build-client.mjs\`.
 */
window.__ModuleLoader__.load({
\tid: ${JSON.stringify(id)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
\t\t/** Registered language identity; \`en\` supplies every untranslated key. */
\t\tconst LANGUAGE = { id: "ru", label: "Русский", fallback: "en" };
\t\t/** Russian dictionaries keyed by locale namespace. */
\t\tconst DICTIONARIES = ${JSON.stringify(dictionaries, null, '\t').replace(/\n/g, '\n\t\t')};
\t\t/** Register the language definition and one dictionary per namespace. */
\t\tfunction apply(ctx) {
\t\t\tctx.effect(() => ctx.locale.addLanguage(LANGUAGE), "locale-ru: language");
\t\t\tfor (const namespace of Object.keys(DICTIONARIES)) {
\t\t\t\tctx.effect(() => ctx.locale.register(namespace, LANGUAGE.id, DICTIONARIES[namespace]), "locale-ru: " + namespace);
\t\t\t}
\t\t}
\t\t/** Required service: the locale registry this pack extends. */
\t\tconst inject = ["locale"];
\t\texports.apply = apply;
\t\texports.inject = inject;
\t\treturn module.exports;
\t}
});
`

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, body)
console.log(`wrote ${path.relative(root, outFile)}: ${Object.keys(dictionaries).length} namespaces, ${Object.values(dictionaries).reduce((n, d) => n + Object.keys(d).length, 0)} keys`)
