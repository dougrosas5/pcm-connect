import { useState } from 'react'
import './App.css'
import BusquedaTareas from './components/BusquedaTareas'

const paginas = ['Planificación', 'Tareas', 'Personal'] as const

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
          <p>PCM Connect · Versión 0.1</p>
        </div>
      </aside>

      <main className="contenido">
        <p className="seccion">OPERACIONES / {paginaActual.toUpperCase()}</p>
        <h1>{paginaActual}</h1>
        {paginaActual === 'Planificación' && (
          <>
            <p>Organización de tareas y recursos de mantenimiento.</p>
            <button className="boton-primario" onClick={() => setPaginaActual('Tareas')}>Búsqueda de tareas</button>
          </>
        )}
        {/* Se mantiene montado para conservar el borrador al cambiar de pantalla. */}
        <section hidden={paginaActual !== 'Tareas'} aria-label="Búsqueda de tareas y OM">
          <BusquedaTareas />
        </section>
        {paginaActual === 'Personal' && (
          <p>Gestión y asignación del personal de mantenimiento. Módulo pendiente de una próxima etapa.</p>
        )}
      </main>
    </div>
  )
}

export default App
