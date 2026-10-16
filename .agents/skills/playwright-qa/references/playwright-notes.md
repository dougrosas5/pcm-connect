# Playwright — puntos comprobados del ZIP original

Fuente proporcionada: `playwright-main(2).zip` (`playwright-main/README.md`). Incluye Playwright Test, CLI y MCP. Sus skills internas (`.claude/skills/playwright-dev/`, `playwright-test-results/`) son para **desarrollar y mantener Playwright en su propio monorepo** y no encajan directamente con una app de mantenimiento.

Para testear PCM Connect usar la distribución oficial `@playwright/test`, sin copiar el repositorio:

```powershell
npm install --save-dev @playwright/test
npx playwright install chromium
npx playwright test
```

Hacer esas instalaciones solo tras inspeccionar el proyecto y con autorización del usuario.

Buenas prácticas: usar `getByRole()`/`getByLabel()`, verificar estados asíncronos, aserciones visibles y trazas/capturas en fallos. Preferir pruebas de flujos completos de negocio, no snapshots frágiles de estilos.
