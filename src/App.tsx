import './App.css'

function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <h2>PCM Connect<span>.</span></h2>
          <p>GESTIÓN DE MANTENIMIENTO</p>
        </div>

        <nav className="menu">
          <button className="menu-activo">Planificación</button>
          <button>Tareas</button>
          <button>Personal</button>
        </nav>

        <div className="sidebar-footer">
          <p>PCM Connect · Versión 0.1</p>
        </div>
      </aside>

      <main className="contenido">
        <p className="seccion">OPERACIONES / PANEL PRINCIPAL</p>
        <h1>Planificación</h1>
        <p>Organización de tareas y recursos de mantenimiento.</p>
      </main>
    </div>
  )
}

export default App
