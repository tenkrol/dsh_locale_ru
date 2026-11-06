# dsh-locale-ru

**Native-quality Russian for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**

[Русская версия](README.ru.md) · MIT · DSH `0.2.2-rc.1+`

![license](https://img.shields.io/badge/license-MIT-blue)
![harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.2--rc.1-1B334D)
![namespaces](https://img.shields.io/badge/namespaces-70%2F73-1F4E79)
![strings](https://img.shields.io/badge/strings-3%2C175-2E7D32)

DSH `0.2.2` ships a built-in Russian locale — machine-translated. This pack adds a second,
hand-written Russian language, **«Русский (нативный)»** (`ru-native`), and falls back to the
built-in Russian (`ru`) for anything not translated yet.

It is an external **client plugin**: nothing is patched inside the app, and removing the package
restores the previous behavior.

## Screenshots

Settings → General → Language, with «Русский (нативный)» selected:

![Settings → General → Language](docs/screenshot-language.png)

The interface itself, in Russian:

![DeepSeek Harness interface in Russian](docs/screenshot-ui.png)

---

## Coverage

| | Native (`ru-native`) | Built-in (`ru`) |
|---|---|---|
| namespaces | **70 of 73** | 73 |
| strings | **3 175** | 3 830 |
| source | hand-written, glossary-driven | machine translation |

Three panels are not translated yet and fall back to the built-in Russian: `forgePanel`,
`liveshare`, `stats`. Everything else — settings, chat, plugin manager, marketplace, scheduling,
trajectory, voice input, permission presets — is native.

`tools/check.mjs --reference` verifies every key and every `{placeholder}` against the English
source of the installed build, so a DSH update turns into a diff instead of a guess.

---

## Install

The pack is a *bundle*: the profile must list it in `dsh.profile.bundles`, and the package must be
resolvable from the profile's `node_modules`. The install script performs both writes plus a
symlink:

```sh
node tools/install.mjs --profile desktop
# roll back:
node tools/install.mjs --profile desktop --uninstall
```

- `--home` overrides `$DSH_HOME` (default `~/.dsh`).
- `--profile` selects the DSH profile name.

After installing, **reload the page** (the browser needs a new `window.__DSH_BOOT__`), then open
**Settings → General → Language** and pick **«Русский (нативный)»**. The built-in «Русский» stays
available; switching between them takes effect immediately.

---

## How it works

| Path | Purpose |
|---|---|
| `package.json` | manifest: `dsh.bundle.patch` (bundle layer) and `dsh.client` (browser half) |
| `cordis.patch.yml` | bundle patch: a single `locale-ru` row mounting the package into the tree |
| `lib/index.js` | host half: an empty plugin, needed only for the composition row |
| `lib/client.js` | **generated** bundle: `addLanguage({ id: 'ru-native', fallback: 'ru' })` + dictionaries |
| `dictionaries/<namespace>.json` | translation sources, one file per namespace |
| `GLOSSARY.md` | glossary and translation rules (terms, placeholders, formatting) |
| `tools/build-client.mjs` | builds `lib/client.js` from `dictionaries/` |
| `tools/check.mjs` | checks without launching the app, including reference parity |
| `tools/extract-reference.cjs` | pulls English dictionaries out of an installed build (`app.asar`) |
| `tools/install.mjs` | installs/removes the pack in a DSH profile |

The language is registered as an overlay:

```js
ctx.locale.addLanguage({ id: 'ru-native', label: 'Русский (нативный)', fallback: 'ru' })
ctx.locale.register(namespace, 'ru-native', dictionary)
```

Lookup walks `ru-native → ru → en`. That is why untranslated keys are never blank: they fall
back to the built-in Russian, then to English. The registration is wrapped in `ctx.effect(...)`,
so removing the bundle removes the language cleanly.

Namespaces must match exactly: a dictionary file is named after the namespace its owning package
registers (`locale.register(ns, { zh, en, … })`). A mismatch silently leaves that namespace in the
fallback language.

---

## Development

```sh
node tools/build-client.mjs                    # dictionaries/*.json -> lib/client.js
node tools/check.mjs                           # structure, bundle load, apply()
node tools/check.mjs --reference .recon/en     # + key and placeholder parity
```

`lib/client.js` is generated — edit `dictionaries/*.json`, never the bundle itself.

To produce the reference for the installed build:

```sh
node tools/extract-reference.cjs "<path-to>/app.asar" .recon/en
```

`--reference <dir>` points at a directory of English dictionaries (`<namespace>.json`) extracted
from an installed DSH build. Without it, `check.mjs` validates structure, JSON validity, bundle
loading and `apply()` calls; with it, it also verifies that the key sets match the English source
and that **every `{placeholder}` survived translation**.

Requirements: Node.js 20.11+ (uses `import.meta.dirname`), no other dependencies.

---

## Limitations

- **Requires DSH `0.2.2-rc.1` or newer** — the overlay falls back to the built-in `ru`, which
  earlier builds do not have. On `0.2.1-rc.5` the package could register `ru` itself; that mode is
  gone, because the locale service rejects a second registration of the same id.
- Three namespaces fall back to the built-in Russian for now: `forgePanel`, `liveshare`, `stats`.
- Pluralization and word order are outside the locale API: dictionaries return ready-made strings,
  so forms like «1 задача / 2 задачи» are split into separate keys.
- `sidebarExcel.language` stays `"en"`: the spreadsheet engine registers only the English locale,
  and `"ru"` there would break number and date formatting.
- Strings hardcoded outside the dictionaries stay English in any language.

---

## Contributing

Corrections, terminology suggestions and new namespace translations are welcome:

1. edit `dictionaries/<namespace>.json` (keep the glossary in `GLOSSARY.md` in sync);
2. run `node tools/build-client.mjs` and `node tools/check.mjs --reference ./reference`;
3. open a pull request with a short description of what changed.

## License

MIT © 2026 tenkrol
