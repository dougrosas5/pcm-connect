import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { construirAPI } from '../scripts/build-api.mjs'
import handler from '../api/pcm.mjs'

test('bundle publicado: autocontenido, actualizado y ejecutable en Node por HTTP', async () => {
  const resultado = await construirAPI(false)
  const chunk = resultado.output.find(
    (archivo: { type: string; fileName: string }) =>
      archivo.type === 'chunk' && archivo.fileName === 'pcm.mjs'
  )
  const publicado = await readFile(new URL('../api/pcm.mjs', import.meta.url), 'utf8')
  assert.ok(chunk)
  assert.equal(publicado, chunk.code, 'Regenerar api/pcm.mjs con npm run build antes de publicar.')
  assert.ok(!/from\s+["']\./u.test(publicado), 'El bundle no debe importar archivos fuente relativos.')
  const anteriorUrl = process.env.SUPABASE_URL
  const anteriorClave = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  const servidor = createServer((req, res) => {
    void handler(req, res)
  })
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  try {
    const direccion = servidor.address() as { port: number }
    const respuesta = await fetch(`http://127.0.0.1:${direccion.port}/api/pcm`)
    assert.equal(respuesta.status, 503)
    assert.match((await respuesta.json()).message, /SUPABASE_URL/u)
    assert.equal(respuesta.headers.get('Cache-Control'), 'no-store')
  } finally {
    await new Promise<void>((resolve, reject) =>
      servidor.close((error) => (error ? reject(error) : resolve()))
    )
    if (anteriorUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = anteriorUrl
    if (anteriorClave === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = anteriorClave
  }
})
