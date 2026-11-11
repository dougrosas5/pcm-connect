import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Sin dependencias de build adicionales. La misma configuración se comprueba en tests.
export async function construirAPI(write = true) {
  return build({
    configFile: false,
    logLevel: 'warn',
    build: {
      ssr: resolve('server/pcm.ts'),
      outDir: 'api',
      emptyOutDir: false,
      copyPublicDir: false,
      target: 'node22',
      minify: false,
      write,
      rolldownOptions: {
        output: {
          entryFileNames: 'pcm.mjs',
          banner:
            '// Generado por scripts/build-api.mjs. Editar server/pcm.ts, src/types/pcm.ts y src/features/planificacion/model; ejecutar npm run build.'
        }
      }
    }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await construirAPI()
