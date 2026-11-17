export default function PageHeader({ titulo }: { titulo: string }) {
  return (
    <header className="page-header">
      <p className="seccion">OPERACIONES / {titulo.toUpperCase()}</p>
      <h1>{titulo}</h1>
    </header>
  )
}
