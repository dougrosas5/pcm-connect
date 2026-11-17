import type { ReactNode } from 'react'

export default function AppShell({ sidebar, header, children }: {
  sidebar: ReactNode
  header: ReactNode
  children: ReactNode
}) {
  return (
    <div className="app">
      <a className="saltar-contenido" href="#contenido-principal">Saltar al contenido</a>
      {sidebar}
      <main id="contenido-principal" className="contenido" tabIndex={-1}>
        {header}
        {children}
      </main>
    </div>
  )
}
