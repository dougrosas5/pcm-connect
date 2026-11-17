const paginas = ['Planificación', 'Tareas', 'Validación Taller', 'Revisión PCM', 'Catálogos', 'Personal', 'Archivo local'] as const
export type Pagina = typeof paginas[number]

export default function Sidebar({ paginaActual, seleccionar }: {
  paginaActual: Pagina
  seleccionar: (pagina: Pagina) => void
}) {
  return (
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
            onClick={() => seleccionar(pagina)}
          >
            {pagina}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <p>PCM Connect · Planificación y revisión</p>
      </div>
    </aside>
  )
}
