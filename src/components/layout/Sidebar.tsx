import Icono, { type NombreIcono } from '../Icono'

const paginas = ['Planificación', 'Tareas', 'Validación Taller', 'Revisión PCM', 'Catálogos', 'Personal', 'Archivo local'] as const
export type Pagina = typeof paginas[number]
const iconos: Record<Pagina, NombreIcono> = { Planificación: 'calendario', Tareas: 'herramientas', 'Validación Taller': 'correcto', 'Revisión PCM': 'documento', Catálogos: 'catalogo', Personal: 'personas', 'Archivo local': 'reloj' }

export default function Sidebar({ paginaActual, seleccionar }: {
  paginaActual: Pagina
  seleccionar: (pagina: Pagina) => void
}) {
  return (
    <aside className="sidebar">
      <nav className="menu" aria-label="Navegación principal">
        {paginas.map(pagina => (
          <button
            key={pagina}
            className={paginaActual === pagina ? 'menu-activo' : ''}
            aria-current={paginaActual === pagina ? 'page' : undefined}
            onClick={() => seleccionar(pagina)}
          >
            <Icono nombre={iconos[pagina]} />
            {pagina}
          </button>
        ))}
      </nav>
    </aside>
  )
}
