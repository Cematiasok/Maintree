# Aprende MaintreeApp
Guía técnica paso a paso para entender cómo funciona el proyecto. Piensa que es una clase universitaria aplicada: recorremos arquitectura, modelo de datos, controladores, servicios, seguridad y buenas prácticas.

## 1. Arquitectura y stack
- **Spring Boot** con autoconfiguración (`@SpringBootApplication` en `MaintreeAppApplication` arranca todo).
- **Capas**: Controller (expone API REST) → Service (reglas de negocio) → Repository (JPA) → Base de datos MySQL.
- **Modelo**: entidades `Usuario`, `Rol`, `Permiso` con relaciones `@ManyToMany`.
- **Seguridad**: hash de contraseñas con BCrypt (`PasswordHasher`). No hay sesión/JWT: las respuestas son "success"/"roles" para el frontend.
- **Correo**: `PasswordRecoveryService` usa `JavaMailSender` para reset de contraseña.
- **Arch estáticos**: HTML/JS/CSS en `src/main/resources/static` servidos por `WebConfig`.

## 2. Configuración clave
Revisa `src/main/resources/application.properties`:
- BD: `spring.datasource.url`, `username`, `password`.
- Mail: `spring.mail.host=localhost`, `spring.mail.port=1025` (Mailhog en local).
- Seeder: `admin.create=true/false`, `admin.email`, `admin.password`.
- Puerto: `server.port=8081`.

`WebConfig`:
- CORS abierto (`allowedOrigins "*"`). Buenas prácticas: limitar a tu dominio en producción.
- Recursos estáticos sin caché (`setCachePeriod(0)`).

## 3. Modelo de datos (JPA)
### Usuario (`model/Usuario.java`)
- Tabla `usuarios`, PK `id`.
- Campos: `nombre`, `apellido`, `email` (único), `especialidad`, `password` (hash), `isActive` (Boolean), `resetToken`, `resetTokenExpiry`.
- Relación **ManyToMany** con `Rol` vía tabla `usuariorol` (eager load).
- Defaults: constructor marca `isActive = FALSE` y crea `roles = new HashSet<>()`.
- Métodos `getIsActive()` y `setIsActive()` nunca devuelven/guardan null (evita NPEs). `getActive()` expone la propiedad como `active` para JSON.

### Rol (`model/Rol.java`)
- Tabla `rol`, campos `id`, `nombre` (único), `descripcion`.
- ManyToMany con `Permiso` vía `rolpermiso` (eager). Útil para autorización futura.

### Permiso (`model/Permiso.java`)
- Tabla `permiso`, campos `id`, `nombre`, `descripcion`.

> Tablas puente: `usuariorol` y `rolpermiso`. En SQL, JPA maneja inserts/joins automáticamente.

## 4. Repositorios (DAO)
- `UsuarioRepository extends JpaRepository<Usuario, Integer>`: métodos derivados `findByEmail`, `findByResetToken`, `findByIsActiveFalse`, `findByIsActiveFalseOrIsActiveIsNull`.
- `RolRepository extends JpaRepository<Rol, Integer>`: `findByNombre`.

## 5. Servicios (lógica de negocio)
### LoginService
- `validarCredenciales(email, password)`:
  1) Busca usuario por email.
  2) Verifica `isActive` (`Boolean.TRUE.equals(isActive)`).
  3) Compara contraseña con BCrypt: 
     ```java
     boolean ok = BCrypt.checkpw(password, usuario.getPassword());
     ```
- Si algo falla, retorna `false` o propaga excepción.

### RegisterService
- `registerUser(newUser, rolNombre)`:
  1) Valida email único (`findByEmail`).
  2) Hashea password con `PasswordHasher.hashPassword`.
  3) Marca `isActive=true` (registro auto-activo aquí; en aprobación se usa otro flujo).
  4) Busca rol por nombre; si no existe, lanza `IllegalStateException`.
  5) Asigna `Set<Rol>` y guarda.

### PasswordRecoveryService
- `initiatePasswordReset(email, requestUrl)`:
  - Genera UUID token + expiry de 1h.
  - Persiste token y fecha en usuario.
  - Envía email con enlace `baseUrl/reset-password.html?token=...`.
  - Si el email no existe, retorna false (pero no lanza error; comportamiento silencioso recomendado para no filtrar usuarios).
- `finalizePasswordReset(token, newPassword)`:
  - Busca usuario por token, valida expiry > ahora.
  - Hashea nueva password, limpia token y expiry, guarda.

### ApproveUsersService
- `getPendingUsers()` devuelve usuarios con `isActive=false` o null.
- `approveUsers(List<Integer>)` marca activos en lote.
- `approveUserWithRole(id, rolNombre)` asigna rol existente y activa.
- `rejectUser(id)` elimina (baja dura; podría ser lógica futura de soft-delete).

### UsuarioService / RolService
- Wrappers de repositorio. `RolService.asignarRolAUsuario` añade un rol si no lo tiene; `revocarRolDeUsuario` lo quita.

## 6. Controladores (API REST)
Todos bajo `/api` salvo admin (`/api/admin`). CORS abierto.

### LoginController `/api/login`
- Recibe JSON de `Usuario` (solo email/password).
- Valida no-nulos. Llama `loginService.validarCredenciales`.
- Si OK: arma mapa `{ success, message, roles, isAdmin }` (isAdmin se deriva si algún rol contiene "ADMIN").
- Si falla: 401 con mensaje.

### RegisterController `/api/register`
- Recibe cuerpo como String, parsea con Gson (razón: esperan campos custom como `rol`).
- Valida que `rol` venga presente.
- Convierte a `Usuario` y llama `registerService.registerUser(newUser, rolNombre)`.
- Respuestas: 201 éxito; 400 si datos inválidos; 409 si email duplicado; 500 si SQL error.

### ForgotPasswordController `/api/forgot-password`
- Recibe `Usuario` con email, usa `request.getRequestURL()` para construir baseUrl en el email.
- Responde siempre 200 con mensaje genérico salvo error interno.

### ResetPasswordController `/api/reset-password?token=...`
- Valida `newPassword` y `confirmPassword` del body.
- Reglas: no vacío, coincide, mínimo 8 chars.
- Llama `recoveryService.finalizePasswordReset`; 200 si éxito, 400 si token inválido/expirado.

### ApproveUsersController (admin) `/api/admin/*`
- `GET /usuarios-pendientes`: lista pendientes.
- `POST /confirmar-roles-lote`: activa varios IDs.
- `POST /usuarios/{id}/aprobar` body `{ "rol": "..." }`: asigna rol y activa.
- `DELETE /usuarios/{id}/rechazar`: borra usuario.

### UsuarioController
- `GET /usuarios`: lista usuarios; filtros opcionales `rol`, `especialidad`, `active` aplicados en memoria (stream). Mejora futura: mover a queries JPA.
- `GET /usuarios/{id}`: busca por id.
- `PUT /usuarios/{id}`: actualiza campos permitidos; si vienen roles, los resuelve por nombre vía `RolRepository`.
- `DELETE /usuarios/{id}`: baja lógica (`isActive=false`).
- `GET /especialidades`: devuelve lista distinta de especialidades existentes.

### RolController
- `GET /roles`: devuelve todos los roles.

## 7. Seeder de administrador
`AdminSeeder implements CommandLineRunner` se ejecuta al arrancar si `admin.create=true`:
1) Crea rol `ADMIN` si falta.
2) Crea usuario `admin@local` con `AdminPass123!` si no existe; si existe, asegura que esté activo y con rol ADMIN.

Buenas prácticas: desactivar en producción (`admin.create=false`) o protegerlo con perfil `dev`.

## 8. Utilidades
- `PasswordHasher`: wrappers estáticos de BCrypt (hashpw, checkpw).
- `PasswordHashingManual.java` y `DatabaseConnection.java`: están vacíos (stubs). Se pueden eliminar o completar; hoy no aportan funcionalidad.

## 9. Flujo extremo a extremo (ejemplos)
### Registro → login
1) POST `/api/register` body ejemplo:
   ```json
   {
     "nombre":"Ana",
     "apellido":"Lopez",
     "email":"ana@example.com",
     "password":"Secreta123",
     "rol":"Supervisor",
     "especialidad":"Electrico"
   }
   ```
2) Servicio hashea password y guarda usuario + rol.
3) POST `/api/login` con email/password → valida activo + BCrypt → responde roles e `isAdmin`.

### Recuperar contraseña
1) POST `/api/forgot-password` con `{ "email":"ana@example.com" }` → genera token y envía link.
2) Usuario abre `reset-password.html?token=...`, envía POST `/api/reset-password?token=...` con `{ "newPassword":"NuevaClave123", "confirmPassword":"NuevaClave123" }`.
3) Servicio valida token no expirado, hashea nueva clave, limpia token.

### Aprobación de usuarios (admin)
- UI `user-admin.html` consume `/api/admin/usuarios-pendientes` para mostrar pendientes.
- Admin aprueba: `POST /api/admin/usuarios/{id}/aprobar` body `{ "rol":"ADMIN" }` o rol deseado.
- Lote: `POST /api/admin/confirmar-roles-lote` con `[1,2,3]` activa esos IDs.

## 10. Buenas prácticas aplicadas y pendientes
Aplicadas:
- Hash de contraseñas con BCrypt; nunca se guardan en claro.
- Null-safety en `isActive` (evita NPEs) y setters defensivos.
- Respuestas coherentes con `success/message` para el frontend.
- Eager fetch de roles para que `login` pueda responder rápido con roles.

Pendientes/mejorables:
1) **Autenticación/Autorización**: agregar Spring Security + JWT/sesión; validar roles en endpoints admin.
2) **Validación de entrada**: usar `@Valid` y DTOs en lugar de `Usuario` directo; sanitizar strings.
3) **CORS**: restringir orígenes en prod.
4) **Consultas filtradas**: mover filtros de `UsuarioController` a queries en `UsuarioRepository` para eficiencia.
5) **Manejo de errores**: crear `@ControllerAdvice` con respuestas unificadas.
6) **Seeder**: activarlo solo en `dev` con `@Profile("dev")` y desactivar en prod.
7) **Permisos**: hoy solo roles; implementar permisos granulares usando entidad `Permiso`.
8) **Archivos estáticos**: habilitar caché en prod (`setCachePeriod` > 0) y versionado de assets.

## 11. Teoría rápida detrás de cada concepto
- **BCrypt**: función de hash adaptativa; incluye salt aleatorio y work factor. Comparar con `BCrypt.checkpw(plain, hash)`.
- **ManyToMany**: JPA crea tabla intermedia; `fetch = EAGER` trae roles/permisos junto al usuario (útil para login pero puede pesar; en prod considerar `LAZY`).
- **CommandLineRunner**: interfaz que ejecuta código al inicio; usada para el seeder.
- **JavaMailSender**: abstracción de Spring para enviar correo SMTP; `MimeMessageHelper` facilita contenido HTML.
- **ResponseEntity**: permite controlar status HTTP + body; usarlo mejora semántica de respuestas.

## 12. Rutas front relevantes
- `index.html`: login.
- `register.html`: registro.
- `reset-password.html`, `recuperar.html`: flujos de password.
- `user-admin.html`, `RoleAssign.html`: panel admin y asignación.

---
Con esto tienes una vista completa del proyecto. Si quieres profundizar en seguridad con Spring Security o mover filtros a consultas JPA, avísame y te dejo ejemplos aplicados al código actual.
