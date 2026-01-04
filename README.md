# Maintree

[![CI](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml)

Aplicación Spring Boot para gestionar usuarios (ABM) con autenticación, registro, recuperación de contraseña por correo y panel de administración. Este README incluye instrucciones rápidas para desarrollo, pruebas y despliegue, y apunta a `aprende.md` con una guía ampliada paso a paso.

> Nota: sustituye `<OWNER>/<REPO>` por tu repositorio real para que el badge muestre el estado del CI.

## Enlaces rápidos
- Guía de aprendizaje ampliada: `aprende.md` (explicaciones línea a línea, ejemplos cURL, errores comunes, tests). ✅
- Código fuente: `src/main/java/com/maintree/proyecto/`

---

## Requisitos
- JDK 22+
- Maven 3.9+
- MySQL 8.x (recomendado) — asegúrate de que la versión del servidor sea 8.x para evitar advertencias de dialecto
- Mailhog (opcional, para pruebas de correo)
- PowerShell o Bash para ejecutar comandos

---

## Configuración rápida (desarrollo)
1) Base de datos
- Crea la BD: `CREATE DATABASE maintreebd;`
- Ajusta credenciales en `src/main/resources/application.properties`:
  - `spring.datasource.url=jdbc:mysql://localhost:3306/maintreebd`
  - `spring.datasource.username=...`
  - `spring.datasource.password=...`

2) Correo (local con Mailhog)
- Ejecuta Mailhog: descarga y ejecuta `mailhog` o usa Docker: `docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog`
- UI de Mailhog: http://localhost:8025
- Configuración en `application.properties` por defecto apunta a `localhost:1025`.

3) Admin seeder (solo para dev)
- `admin.create=true` crea rol `ADMIN` y usuario `admin@local` con `AdminPass123!` al arrancar.
- En producción, desactiva: `admin.create=false` o usa perfiles (`spring.profiles.active=prod`).

---

## Cómo ejecutar
- Compilar y correr tests:
```bash
mvn test
```
- Ejecutar la app en desarrollo:
```bash
mvn spring-boot:run
```
- Empaquetar y ejecutar JAR:
```bash
mvn -DskipTests package
java -jar target/maintree-1.0-SNAPSHOT.jar
```
- Accede a la UI: `http://localhost:8081/` (ajusta `server.port` en `application.properties` si es necesario).

---

## Tests y calidad
- Ejecuta la suite completa: `mvn test` (incluye tests unitarios e integración con MockMvc).
- Para ejecutar un test en particular: `mvn -Dtest=RegisterServiceTest#* test`.
- Notas:
  - Mockito usa un agente dinámico en tests locales; es informativo pero se recomienda configurar Mockito como agente para entornos stricter.
  - Los tests de integración usan una base en memoria/BD local según configuración.

---

## Seguridad y recomendaciones de producción
- Contraseñas: se usa `BCrypt` (via `PasswordEncoder`) para hashear contraseñas con salt y coste configurable.
- Rutas sensibles: `/api/admin/**` están protegidas por rol ADMIN (configurado en `SecurityConfig`).
- CSRF: deshabilitado para APIs REST en dev; habilítalo si sirves formularios desde el servidor.
- HTTPS: fuerza HTTPS en producción y marca cookies como `Secure; HttpOnly`.
- Sessions: la app actualmente persiste `SecurityContext` en sesión para compatibilidad con la UI basada en cookies; si migras a SPA considera JWT.

---

## Uso rápido: ejemplos cURL (prácticos)
- Login:
```bash
curl -i -X POST http://localhost:8081/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local","password":"AdminPass123!"}'
```
- Registrar usuario:
```bash
curl -i -X POST http://localhost:8081/api/register -H "Content-Type: application/json" -d '{"nombre":"Ana","apellido":"Lopez","email":"ana@example.com","password":"Secreta123","rol":"CLIENTE"}'
```
- Ejecutar la suite de tests:
```bash
mvn test
```

---

## Estructura del proyecto
- Código Java: `src/main/java/com/maintree/proyecto/`
  - `controller/`, `service/`, `dao/`, `config/`, `util/`
- Recursos: `src/main/resources/` (properties, static assets y SQL)
- Tests: `src/test/java/` (unitarios e integración)

---

## Errores comunes y soluciones rápidas
- NullPointer en tests por inyección de dependencias: usa inyección por constructor y `@InjectMocks` en pruebas.
- `rawPassword cannot be null` al hashear: asegurar que `password` esté presente antes de llamar a `passwordEncoder.encode`.
- Problemas con sesiones en MockMvc: almacenar `SPRING_SECURITY_CONTEXT` en la sesión o usar helpers de Spring Security para tests.

---

## Contribuir
1. Crea una rama por feature: `git checkout -b feat/nombre-feature`.
2. Añade tests para cualquier cambio en lógica de negocio.
3. Ejecuta `mvn test` localmente y solicita PR.

---

## Recursos adicionales
- `aprende.md`: guía ampliada con ejemplos concretos y sección "Explicación línea a línea".
- Documentación oficial: Spring Boot, Spring Security, JPA/Hibernate.

Si quieres, puedo añadir un archivo `CONTRIBUTING.md` y configurar un workflow de GitHub Actions para ejecutar `mvn test` en cada PR.