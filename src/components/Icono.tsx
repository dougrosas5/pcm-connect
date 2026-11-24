import type { ReactNode } from 'react'

const trazos = {
  barco: <><path d="M3 16h18l-4 4H7zM6 16v-5h11v5M9 11V7h5v4M11 7V3M14 7h3" /><path d="M2 22c2-2 4 2 6 0s4 2 6 0 4 2 8 0" /></>,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M13 14h3M7 18h2"/></>,
  documento: <><path d="M14 3H5v18h14V8zM14 3v6h5M8 12h8M8 16h5"/></>,
  herramientas: <><path d="m4 3 5 5-3 3-5-5M8 10l12 11 2-2L11 8M20 3a5 5 0 0 0-6 6L3 20l2 2L16 11a5 5 0 0 0 6-6l-4 4-3-3z"/></>,
  usuario: <><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3z"/></>,
  personas: <><circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 4 5v2"/></>,
  catalogo: <><rect x="4" y="3" width="16" height="19" rx="2"/><path d="M8 7h8M8 12h8M8 17h5"/></>,
  inicio: <><path d="m2 11 10-9 10 9M5 9v12h5v-7h4v7h5V9"/></>,
  reloj: <><circle cx="12" cy="12" r="9"/><path d="M12 6v7l5 3"/></>,
  guardar: <><path d="M3 3h15l3 3v15H3zM7 3v7h10V3M7 21v-7h10v7"/></>,
  enviar: <><path d="m2 11 20-9-7 20-4-8zM11 14 22 2"/></>,
  buscar: <><circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/></>,
  actualizar: <><path d="M20 9a8 8 0 0 0-14-4L3 8M3 3v5h5M4 15a8 8 0 0 0 14 4l3-3M21 21v-5h-5"/></>,
  informacion: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  ayuda: <><circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18h.01"/></>,
  mas: <path d="M12 3v18M3 12h18"/>,
  bajar: <path d="m6 9 6 6 6-6"/>,
  subir: <path d="m6 15 6-6 6 6"/>,
  eliminar: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></>,
  correcto: <path d="m4 12 5 5L20 5"/>,
  ubicacion: <><path d="M19 9c0 6-7 13-7 13S5 15 5 9a7 7 0 0 1 14 0z"/><circle cx="12" cy="9" r="2"/></>,
  bandera: <path d="M4 22V3c6-5 10 5 16 0v11c-6 5-10-5-16 0"/>,
} satisfies Record<string, ReactNode>

export type NombreIcono = keyof typeof trazos

export default function Icono({ nombre, className = '' }: { nombre: NombreIcono; className?: string }) {
  return <svg className={`icono ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{trazos[nombre]}</svg>
}
