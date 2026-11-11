export function descargarTexto(nombre: string, texto: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
