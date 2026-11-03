import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { crearHandler } from './api/pcm.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const entorno = loadEnv(mode, process.cwd(), '')
  const api = crearHandler(() => ({
    url: entorno.SUPABASE_URL ?? '',
    clave: entorno.SUPABASE_SERVICE_ROLE_KEY ?? ''
  }))
  return {
    plugins: [
      react(),
      {
        name: 'pcm-api-desarrollo',
        configureServer(servidor) {
          servidor.middlewares.use('/api/pcm', async (req, res) => {
            try {
              const partes: Buffer[] = []
              let bytes = 0
              for await (const parte of req) {
                const buffer = Buffer.from(parte)
                bytes += buffer.length
                if (bytes > 3_000_000) {
                  res.statusCode = 413
                  res.end('Solicitud demasiado grande')
                  return
                }
                partes.push(buffer)
              }
              const headers = new Headers()
              for (const [clave, valor] of Object.entries(req.headers))
                if (valor) headers.set(clave, Array.isArray(valor) ? valor.join(',') : valor)
              const respuesta = await api(
                new Request('http://localhost/api/pcm', {
                  method: req.method,
                  headers,
                  ...(['GET', 'HEAD'].includes(req.method ?? 'GET')
                    ? {}
                    : { body: Buffer.concat(partes).toString('utf8') })
                })
              )
              res.statusCode = respuesta.status
              respuesta.headers.forEach((valor, clave) => res.setHeader(clave, valor))
              res.end(await respuesta.text())
            } catch {
              res.statusCode = 503
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ message: 'No se pudo atender la API local.' }))
            }
          })
        }
      }
    ]
  }
})
