import { useState } from 'react'
import './App.css'
import Planificaciones from './components/Planificaciones'
import Modulo1 from './components/modulo1/Modulo1'

const paginas = ['Planificación', 'Tareas', 'Validación Taller', 'Catálogos', 'Personal', 'Archivo local'] as const

function App() {
  const [paginaActual, setPaginaActual] = useState<typeof paginas[number]>('Planificación')

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <h2>PCM Connect<span>.</span></h2>
          <p>GESTIÓN DE MANTENIMIENTO</p>
        </div>
        <nav className="menu" aria-label="Navegación principal">
          {paginas.map(pagina => (
            <button
              key={pagina}
              className={paginaActual === pagina ? 'menu-activo' : ''}
              aria-current={paginaActual === pagina ? 'page' : undefined}
              onClick={() => setPaginaActual(pagina)}
            >
              {pagina}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>PCM Connect · Módulo 1 v1.3</p>
        </div>
      </aside>

      <main className="contenido">
        <p className="seccion">OPERACIONES / {paginaActual.toUpperCase()}</p>
        <h1>{paginaActual}</h1>
        <section hidden={paginaActual === 'Personal' || paginaActual === 'Archivo local'} aria-label="Planificación de tareas v1.3">
          <Modulo1 vista={paginaActual === 'Validación Taller' ? 'taller' : paginaActual === 'Catálogos' ? 'catalogos' : 'plan'} />
        </section>
        {paginaActual === 'Archivo local' && <section aria-label="Versión anterior"><p className="aviso-guardado">Archivo de la demo anterior. Estos planes conservan sus reglas históricas de evaluación por OM y no se mezclan con las propuestas v1.3.</p><Planificaciones /></section>}
        {paginaActual === 'Personal' && (
          <p>Gestión y asignación del personal de mantenimiento. Módulo pendiente de una próxima etapa.</p>
        )}
      </main>
    </div>
  )
}

export default App
