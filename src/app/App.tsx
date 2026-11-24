import { useState } from 'react'
import '../styles/app.css'
import Planificaciones from '../features/archivo-local/components/Planificaciones'
import EspacioPCM from './EspacioPCM'
import AppShell from '../components/layout/AppShell'
import PageHeader from '../components/layout/PageHeader'
import Sidebar, { type Pagina } from '../components/layout/Sidebar'
import type { TipoCatalogo } from '../types/pcm'

function App() {
  const [paginaActual, setPaginaActual] = useState<Pagina>('Planificación')
  const [catalogoInicial, setCatalogoInicial] = useState<TipoCatalogo>('remolcadores')

  return (
    <AppShell
      sidebar={<Sidebar paginaActual={paginaActual} seleccionar={setPaginaActual} />}
      header={<PageHeader titulo={paginaActual} />}
    >
      <section hidden={paginaActual === 'Personal' || paginaActual === 'Archivo local'} aria-label={paginaActual}>
        <EspacioPCM
          vista={paginaActual === 'Revisión PCM' ? 'revision' : paginaActual === 'Validación Taller' ? 'taller' : paginaActual === 'Catálogos' ? 'catalogos' : 'plan'}
          catalogoInicial={catalogoInicial}
          abrirUbicaciones={() => {
            setCatalogoInicial('ubicaciones')
            setPaginaActual('Catálogos')
          }}
        />
      </section>
      {paginaActual === 'Archivo local' && <section aria-label="Versión anterior"><p className="aviso-guardado">Planificaciones locales con evaluación por OM. Se gestionan por separado de las planificaciones actuales.</p><Planificaciones /></section>}
      {paginaActual === 'Personal' && (
        <p>El registro de personal aún no está habilitado.</p>
      )}
    </AppShell>
  )
}

export default App
