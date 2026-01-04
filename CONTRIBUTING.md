# Contribuir a Maintree

Gracias por contribuir a Maintree. Esta guía rápida explica cómo aportar cambios, buenas prácticas de commits, pruebas y cómo funciona el CI.

## Flujo de trabajo
- Crea un issue antes de implementar cambios importantes (descripción clara + pasos para reproducir).
- Crea una rama a partir de `main` con un nombre descriptivo:
  - feat/<descripción-breve>
  - fix/<descripción-breve>
  - chore/<descripción-breve>

## Requisitos locales
- JDK 22+
- Maven 3.9+
- MySQL local o configurado en `src/main/resources/application.properties` para pruebas locales

## Ejecutar la aplicación y tests
- Ejecutar tests:
  ```bash
  mvn test
  ```
- Ejecutar un test puntual:
  ```bash
  mvn -Dtest=NombreDelTest#* test
  ```
- Ejecutar la app en desarrollo:
  ```bash
  mvn spring-boot:run
  ```

## Estilo de commits
Usa mensajes claros y descriptivos (sugerencia: Conventional Commits):
- feat: nueva funcionalidad
- fix: corrección
- docs: documentación
- test: tests
- chore: mantenimiento

Ejemplo:
```
feat(register): agregar validación de email único
```

## Pull Request (PR)
- Asegúrate de que la rama esté actualizada con `main`.
- Añade una descripción clara en el PR: ¿qué hace el cambio? ¿Por qué? ¿Cómo probarlo?
- Incluye tests que cubran cambios en lógica de negocio.
- La CI (GitHub Actions) ejecutará la suite de tests automáticamente en cada PR.

## Tests y QA
- Añade tests unitarios para nueva lógica de negocio y tests de integración si el cambio afecta rutas y seguridad.
- No committees secretos ni credenciales. Usa variables de entorno o `application.properties` de ejemplo.

## Revisión y merge
- Se requiere al menos 1 aprobación de revisión de código antes de merge.
- Si el PR cambia el modelo de datos o migraciones, documenta claramente la migración y la estrategia de rollout.

## Preguntas
Si tienes dudas, abre un issue o conversa en el PR. ¡Gracias por contribuir! 🎉
