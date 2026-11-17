import { useState } from 'react'
import '../styles/app.css'
import Planificaciones from '../features/archivo-local/components/Planificaciones'
import EspacioPCM from './EspacioPCM'
import AppShell from '../components/layout/AppShell'
import PageHeader from '../components/layout/PageHeader'
import Sidebar, { type Pagina } from '../components/layout/Sidebar'

function App() {
  const [paginaActual, setPaginaActual] = useState<Pagina>('Planificación')

  return (
    <AppShell
      sidebar={<Sidebar paginaActual={paginaActual} seleccionar={setPaginaActual} />}
      header={<PageHeader titulo={paginaActual} />}
    >
      <section hidden={paginaActual === 'Personal' || paginaActual === 'Archivo local'} aria-label="Planificación de tareas v1.3">
        <EspacioPCM vista={paginaActual === 'Revisión PCM' ? 'revision' : paginaActual === 'Validación Taller' ? 'taller' : paginaActual === 'Catálogos' ? 'catalogos' : 'plan'} />
      </section>
      {paginaActual === 'Archivo local' && <section aria-label="Versión anterior"><p className="aviso-guardado">Archivo de la demo anterior. Estos planes conservan sus reglas históricas de evaluación por OM y no se mezclan con las propuestas v1.3.</p><Planificaciones /></section>}
      {paginaActual === 'Personal' && (
        <p>Gestión y asignación del personal de mantenimiento. Módulo pendiente de una próxima etapa.</p>
      )}
    </AppShell>
  )
}

export default App
