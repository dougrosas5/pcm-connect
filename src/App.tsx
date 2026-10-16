import {useState} from 'react'
import './App.css'
import { tareasDemo } from './data/tareas'

function App() {
  const [paginaActual, setPaginaActual] = useState('Planificación')
  
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <h2>PCM Connect<span>.</span></h2>
          <p>GESTIÓN DE MANTENIMIENTO</p>
        </div>

        
<nav className="menu">
  <button
    className={paginaActual === 'Planificación' ? 'menu-activo' : ''}
    onClick={() => setPaginaActual('Planificación')}
  >
    Planificación
  </button>

  <button
    className={paginaActual === 'Tareas' ? 'menu-activo' : ''}
    onClick={() => setPaginaActual('Tareas')}
  >
    Tareas
  </button>

  <button
    className={paginaActual === 'Personal' ? 'menu-activo' : ''}
    onClick={() => setPaginaActual('Personal')}
  >
    Personal
  </button>
</nav>


        <div className="sidebar-footer">
          <p>PCM Connect · Versión 0.1</p>
        </div>
      </aside>

      <main className="contenido">
        <p className="seccion">OPERACIONES / {paginaActual.toUpperCase()}</p>

        <h1>{paginaActual}</h1>

        {paginaActual === 'Planificación' && (
          <p>Organización de tareas y recursos de mantenimiento</p>
        )}

        {paginaActual === 'Tareas' && (
        <>
          <p>Catalogo general de tareas de mantenimiento.</p>
          
          <div className="tabla-contenedor">
            <table className="tabla-tareas">

              <thead>
                <tr>
                  <th>N° de tarea</th>
                  <th>N° de OM</th>
                  <th>Área</th>
                  <th>Horas</th>
                  <th>Criticidad</th>
                  <th>Responsable</th>
                  <th>Personas</th>
                </tr>
              </thead>

              <tbody>
                {tareasDemo
                  .filter(tarea => tarea.estado === 'Abierta')
                  .flatMap(tarea =>
                    tarea.ordenesMantenimiento.map((om) => (
                      <tr key={`${tarea.numero}-${om}`}>
                        <td>{tarea.numero}</td>
                        <td>{om}</td>
                        <td>{tarea.area}</td>
                        <td>{tarea.horas}</td>
                        <td>{tarea.criticidad}</td>
                        <td>
                          <input
                            type="text"
                            aria-label={`Responsable de tarea ${tarea.numero}, OM ${om}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            aria-label={`Personas de tarea ${tarea.numero}, OM ${om}`}
                          />
                        </td>
                      </tr>
                    ))
                  )}
              </tbody>
            </table>
          </div>
        </>
        )}

        {paginaActual === 'Personal' && (
          <p>Gestión y asignacion del personal de mantenimiento.</p>
        )}
      </main>
    </div>
  )
}

export default App
