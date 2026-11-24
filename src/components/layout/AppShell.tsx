import type { ReactNode } from 'react'
import Icono from '../Icono'

export default function AppShell({ sidebar, header, children }: {
  sidebar: ReactNode
  header: ReactNode
  children: ReactNode
}) {
  return (
    <div className="app">
      <a className="saltar-contenido" href="#contenido-principal">Saltar al contenido</a>
      <header className="topbar">
        <div className="topbar-marca"><Icono nombre="barco" /><strong>PCM CONNECT</strong></div>
        <span className="topbar-titulo">Mantenimiento de remolcadores</span>
        <details className="topbar-ayuda"><summary aria-label="Ayuda de PCM Connect"><Icono nombre="ayuda" /></summary><div><strong>Ayuda</strong><p>Prepará las tareas en Planificación. Después del envío, Taller las evalúa y PCM revisa el resultado.</p><p>Consultá el historial de cambios al pie de la pantalla.</p></div></details>
      </header>
      {sidebar}
      <main id="contenido-principal" className="contenido" tabIndex={-1}>
        {header}
        {children}
      </main>
    </div>
  )
}
