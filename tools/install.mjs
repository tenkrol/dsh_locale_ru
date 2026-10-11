/**
 * Install or remove this language pack in a DSH profile.
 *
 * The pack is a bundle: it declares `dsh.bundle.patch`, so a profile that lists
 * it in `dsh.profile.bundles` picks up its row. This script performs the three
 * writes that a package manager would otherwise do:
 *   1. link the package into the profile's `node_modules`,
 *   2. record the dependency in the profile `package.json`,
 *   3. append the bundle name to `dsh.profile.bundles`.
 *
 * Usage:
 *   node tools/install.mjs --profile desktop
 *   node tools/install.mjs --profile desktop --uninstall
 *   node tools/install.mjs --profile ru-test --home /path/to/home
 *
 * The profile's `node_modules` is written by hand (a symlink) instead of pnpm,
 * because the pack has no dependencies and needs no registry access.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const packageRoot = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
const name = pkg.name

const argv = process.argv.slice(2)
const flag = (key) => {
  const i = argv.indexOf(key)
  return i === -1 ? undefined : argv[i + 1]
}
const profile = flag('--profile') ?? 'desktop'
const home = flag('--home') ?? process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
const uninstall = argv.includes('--uninstall')

const profileDir = path.join(home, 'profiles', profile)
if (!fs.existsSync(profileDir)) {
  console.error(`profile directory not found: ${profileDir}`)
  process.exit(1)
}
const manifestPath = path.join(profileDir, 'package.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const linkPath = path.join(profileDir, 'node_modules', name)
const rel = path.relative(path.join(profileDir, 'node_modules'), packageRoot)

const changes = []
if (uninstall) {
  if (fs.existsSync(linkPath) || fs.lstatSync(linkPath, { throwIfNoEntry: false })) {
    fs.rmSync(linkPath, { force: true }); changes.push(`removed ${linkPath}`)
  }
  if (manifest.dependencies?.[name] !== undefined) {
    delete manifest.dependencies[name]; changes.push('removed dependency')
  }
  if (manifest.dsh?.profile?.bundles?.includes(name)) {
    manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter((b) => b !== name)
    changes.push('removed bundle selection')
  }
} else {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true })
  if (!fs.existsSync(linkPath)) { fs.symlinkSync(packageRoot, linkPath, 'dir'); changes.push(`linked ${linkPath} -> ${packageRoot}`) }
  manifest.dependencies ??= {}
  const spec = `file:${rel}`
  if (manifest.dependencies[name] !== spec) { manifest.dependencies[name] = spec; changes.push(`dependency ${name}: ${spec}`) }
  manifest.dsh ??= {}
  manifest.dsh.profile ??= {}
  manifest.dsh.profile.bundles ??= []
  if (!manifest.dsh.profile.bundles.includes(name)) { manifest.dsh.profile.bundles.push(name); changes.push('selected bundle') }
}

if (changes.length) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`${uninstall ? 'uninstall' : 'install'} profile=${profile} home=${home}`)
for (const c of changes) console.log(`  ${c}`)
if (!changes.length) console.log('  already in the requested state')
console.log(`bundles: ${JSON.stringify(manifest.dsh.profile.bundles)}`)
