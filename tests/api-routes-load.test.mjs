import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const apiDir = join(root, 'api')

function routeFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '_lib' ? [] : routeFiles(full)
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : []
  })
}

// Every file under api/ (excluding _lib) becomes a Vercel Function. A bad relative
// import only surfaces at invocation time as FUNCTION_INVOCATION_FAILED, so verify
// each module actually resolves and exports a handler.
test('every API route module loads and exports a default handler', async () => {
  const files = routeFiles(apiDir)
  assert.ok(files.length > 0, 'no API routes found')

  const failures = []
  for (const file of files) {
    const name = relative(root, file)
    try {
      const mod = await import(pathToFileURL(file).href)
      if (typeof mod.default !== 'function') {
        failures.push(`${name}: no default export handler`)
      }
    } catch (err) {
      failures.push(`${name}: ${err.message}`)
    }
  }

  assert.deepEqual(failures, [], `broken API routes:\n${failures.join('\n')}`)
})
