# Aprende Maintree
Guía técnica paso a paso para entender cómo funciona el proyecto. Piensa que es una clase universitaria aplicada: recorremos arquitectura, modelo de datos, controladores, servicios, seguridad y buenas prácticas.

## Resumen fácil (para personas no técnicas) 💡
Maintree es una pequeña aplicación que gestiona usuarios y permisos. Permite registrar usuarios, iniciar sesión, recuperar contraseñas y que un administrador apruebe o administre cuentas. En términos sencillos: es la parte del sistema que controla quién puede entrar, qué puede ver y qué puede hacer.

## Cómo arrancar la aplicación (paso a paso) ▶️
**Requisitos previos**
- Java 21 instalado (comprueba con `java -version`).
- Maven instalado si vas a ejecutar desde código (`mvn`) o JDK con `java` para ejecutar el JAR.
- Una base de datos MySQL si quieres usar los datos reales. Para pruebas locales, el proyecto usa H2 en memoria en los tests.
- (Opcional) Mailhog o similar en local para ver correos de recuperación: configuración por defecto usa `localhost:1025`.

**Arrancar en desarrollo (Windows / PowerShell)**
1) Abrir PowerShell en la carpeta del proyecto.
2) Compilar y arrancar con Maven:
```powershell
mvn spring-boot:run
```
Esto usará la configuración en `src/main/resources/application.properties` (por defecto `server.port=8081`).

**Generar JAR y ejecutar**
```powershell
mvn -DskipTests package
java -jar target/maintree-1.0-SNAPSHOT.jar
```

**Cambiar configuración**
- Si necesitas apuntar a una base MySQL, edita `src/main/resources/application.properties` y configura `spring.datasource.url`, `spring.datasource.username` y `spring.datasource.password`.
- Para recibir correos en local instala Mailhog o cambia `spring.mail.*` en `application.properties`.

**Comprobaciones rápidas**
- Accede a `http://localhost:8081/login.html` (o la ruta que tengas configurada).
- Revisa logs en consola; si arrancó correctamente verás el mensaje `Started MaintreeApplication` y el puerto.

**Problemas comunes y soluciones**
- Error `Java version`: instala Java 21 o ajusta `pom.xml` al JDK disponible.
- Error de conexión a BD: revisa `spring.datasource.*` y que MySQL esté corriendo y accesible.
- No llegan correos: instala Mailhog y configura `spring.mail.host=localhost` y `spring.mail.port=1025`.

---

## Arrancar con Docker 🐳
A continuación tienes pasos concretos para ejecutar Maintree en contenedores Docker. Incluye un ejemplo de `Dockerfile` (multistage) y un `docker-compose.yml` para ejecutar la app junto con MySQL y Mailhog.

### Opción A — Imagen multistage (construir + ejecutar)
1) Crea un archivo `Dockerfile` en la raíz del proyecto con este contenido:

```dockerfile
# Stage 1: build
FROM maven:3.9.1-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests package

# Stage 2: runtime
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/maintree-1.0-SNAPSHOT.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

2) Construir la imagen (desde la raíz del repo):
```bash
docker build -t maintree:latest .
```

3) Ejecutar localmente apuntando a una base de datos existente o usando parámetros por defecto:
```bash
docker run --rm -p 8081:8081 \
  -e SPRING_DATASOURCE_URL=jdbc:mysql://host.docker.internal:3306/maintree \
  -e SPRING_DATASOURCE_USERNAME=miusuario \
  -e SPRING_DATASOURCE_PASSWORD=miclave \
  maintree:latest
```
- Nota: en Windows/Mac usa `host.docker.internal` para acceder a servicios en la máquina host.

### Opción B — Usar Docker Compose (MySQL + Mailhog + App)
1) Crea `docker-compose.yml` en la raíz con este ejemplo:

```yaml
version: '3.8'
services:
  db:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: maintree
      MYSQL_USER: maintree
      MYSQL_PASSWORD: secret
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql
    healthcheck:
      test: [ "CMD", "mysqladmin", "ping", "-h", "localhost" ]
      interval: 10s
      timeout: 5s
      retries: 5

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"
      - "8025:8025"

  app:
    build: .
    image: maintree:latest
    ports:
      - "8081:8081"
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://db:3306/maintree
      SPRING_DATASOURCE_USERNAME: maintree
      SPRING_DATASOURCE_PASSWORD: secret
      SPRING_MAIL_HOST: mailhog
      SPRING_MAIL_PORT: 1025
    depends_on:
      - db
      - mailhog

volumes:
  db_data:
```

2) Arrancar todo:
```bash
docker compose up -d --build
```
3) Comprobar estado y logs:
```bash
docker compose ps
docker compose logs -f app
```
4) Abrir en navegador:
- App: http://localhost:8081
- Mailhog UI (ver correos): http://localhost:8025

### Notas y buenas prácticas
- Variables de Spring Boot se pasan como variables de entorno: usa `SPRING_DATASOURCE_URL`, `SPRING_MAIL_HOST`, etc.
- Si prefieres no reconstruir la imagen al cambiar código, usa `mvn -DskipTests package` y luego `docker compose up --no-build` o monta el JAR con un volumen en desarrollo.
- Para producción: usa imágenes base más ligeras, agrega salud (healthchecks), límites de recursos y no habilites la creación automática de esquemas en `spring.jpa.hibernate.ddl-auto`.

---


## 1. Arquitectura y stack
- **Spring Boot** con autoconfiguración (`@SpringBootApplication` en `MaintreeApplication` arranca todo).
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
- `login.html`: login.
- `register.html`: registro.
- `reset-password.html`, `recuperar.html`: flujos de password.
- `user-admin.html`, `RoleAssign.html`: panel admin y asignación.

---
Con esto tienes una vista completa del proyecto. A continuación se añade una versión ampliada y didáctica (arquitectura, seguridad, ejemplos prácticos y comandos) para que puedas aprender paso a paso:

---

# Aprende Maintree — Guía ampliada y explicada paso a paso

Esta guía está pensada como material de aprendizaje: incluye explicaciones de diseño, por qué se eligieron ciertas soluciones, y ejemplos concretos para que puedas ejecutar y modificar el proyecto con seguridad.

## 0. Objetivo de esta guía
- Entender la arquitectura y las responsabilidades de cada capa.
- Conocer las decisiones de diseño (por qué) y ver ejemplos prácticos.
- Saber cómo probar y depurar funcionalidades principales (login, registro, recuperación, admin).

---
## 1. Arquitectura y stack (visión ampliada)
- **Spring Boot (3.x)**: provee autoconfiguración, servidor embebido, y facilidad para integrar Web, JPA, Mail y Security.
- **Capas y responsabilidades**:
  - Controller: orquesta peticiones HTTP y respuestas (validación básica, mapping DTO ↔ entidad).
  - Service: contenedor de reglas de negocio y transacciones.
  - Repository: abstracción de acceso a datos (JPA).
  - Model: clases JPA que representan la base de datos.
- **Separación de capas**: facilita pruebas unitarias y mantenimiento.

---
## 2. Configuración (qué hace cada propiedad importante)
Archivo: `src/main/resources/application.properties`
- `spring.datasource.*`: conecta la app a la base de datos (host, credentials). Si cambias esto apuntas a otra BD.
- `spring.jpa.hibernate.ddl-auto=update`: en dev actualiza el esquema; en prod usar migraciones controladas (Flyway/Liquibase).
- `spring.mail.*`: configura envío de email (Mailhog en local para pruebas).
- `admin.create`, `admin.email`, `admin.password`: variables para el seeder de administrador en desarrollo.
- `server.port`: puerto de la aplicación (en este repo 8081 por defecto).

`WebConfig` (CORS y recursos estáticos):
- `allowedOrigins("*")` simplifica pruebas locales, pero en producción debes limitar a dominios de confianza.
- `setCachePeriod(0)` evita cache en desarrollo; en producción asigna tiempo mayor para rendimiento.

---
## 3. Modelo de datos — explicación práctica
### Entidad Usuario
- Campos críticos:
  - `email` (único): sirve como identificador para login.
  - `password`: se guarda como hash (BCrypt).
  - `isActive`: control de estado (registro activo o pendiente).
  - `resetToken` y `resetTokenExpiry`: para recuperación de contraseña.
- Diseño: usar getters/setters que eviten nulls para prevenir NullPointerException.

### Entidad Rol
- Roles como `ADMIN`, `CLIENTE` otorgan accesos distintos. Se usan para mapear a `GrantedAuthority` en Spring Security.

¿Por qué `ManyToMany` con `EAGER`?
- Facilita obtener roles al autenticar (no necesitas una query adicional). En apps más grandes convendría `LAZY` y una consulta específica para rendimiento.

---
## 4. Repositorios (cómo sacas ventaja)
- Extender `JpaRepository` proporciona CRUD, paginación y queries derivadas sin escribir SQL.
- Ejemplo: `UsuarioRepository.findByEmail(email)` crea la consulta automáticamente.
- Cuando necesites consultas complejas: usa `@Query` o `Criteria`.

---
## 5. Servicios — responsabilidad y ejemplos
### LoginService
- Lógica: buscar usuario, verificar `isActive`, comparar password con BCrypt.
- Por qué en servicio: desacopla la validación de credenciales del controller (más testable).

### RegisterService
- Validaciones: email único y existencia de rol.
- Hasheo de contraseña: hace `passwordEncoder.encode(rawPassword)` (BCrypt).
- Ejemplo de código:
```java
String hashed = passwordEncoder.encode(newUser.getPassword());
newUser.setPassword(hashed);
usuarioRepository.save(newUser);
```

### PasswordRecoveryService
- Genera token (UUID) con expiry; envía correo con link seguro.
- Buenas prácticas: no revelar si el email existe; responder mensaje genérico.

---
## 6. API (controladores) — ejemplos y razones
- Controllers validan la entrada y devuelven `ResponseEntity` con status apropiado.
- Usar DTOs y `@Valid` evita exponer entidades directamente.

Ejemplo: `ForgotPasswordController` (DTO + `@Valid`)
```java
@PostMapping("/forgot-password")
public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest dto) {
  recoveryService.initiatePasswordReset(dto.getEmail(), requestUrl);
  return ResponseEntity.ok(Map.of("success", true, "message", "Si tu correo está registrado..."));
}
```

---
## 7. Seguridad: implementación y explicación línea a línea
Objetivo: autenticar usuarios, almacenar su sesión (o emitir token) y autorizar accesos por rol.

1) Dependencia: `spring-boot-starter-security`.

2) `SecurityConfig.java` — decisiones clave:
- `PasswordEncoder` (BCrypt): para encriptar contraseñas al registrar usuarios.
- Definir rutas públicas (`/api/login`, `/api/register`, `/api/forgot-password`).
- Proteger rutas admin con `hasRole("ADMIN")`.
- Habilitar `@EnableMethodSecurity` para usar `@PreAuthorize` en métodos.

Fragmento y explicación:
```java
http.csrf(csrf -> csrf.disable())
  .authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/login","/api/register","/api/forgot-password").permitAll()
    .requestMatchers("/api/admin/**").hasRole("ADMIN")
    .anyRequest().authenticated()
  )
  .httpBasic();
```
- `csrf.disable()` se usa para APIs REST; si tienes formularios HTML en el servidor, habilita CSRF y añade token en formularios.

3) `CustomUserDetailsService`:
- Convierte `Usuario` + `Rol` → `UserDetails` + `GrantedAuthority`.
- Lanza `UsernameNotFoundException` si no encuentra usuario o no esta activo.

4) Login manual (opción del proyecto):
- `LoginController` valida credenciales (LoginService) y si son correctas crea un `Authentication` y lo guarda en `SecurityContext` y en la sesión (para que MockMvc y navegadores mantengan sesión).
- Alternativa: delegar a `UsernamePasswordAuthenticationFilter` y `formLogin()` de Spring Security.

¿Por qué este enfoque?
- Mantiene compatibilidad con el frontend actual y te da control total del formato de respuesta (roles, isAdmin, etc.).

---
## 8. Tests (práctico)
- Tests de integración con `MockMvc` prueban:
  - Endpoints requieren auth (401 sin sesión).
  - Login produce sesión válida y permite acceso a rutas protegidas.
  - Roles (ADMIN/CLIENTE) resultan en accesos permitidos/denegados.

Ejecutar tests:
```bash
mvn -Dtest=SecurityIntegrationTest test
```

---
## 9. Comandos y ejemplos prácticos (rápido para probar)
- Compilar: `mvn -DskipTests package`
- Ejecutar app: `mvn spring-boot:run`
- Login (curl):
```bash
curl -i -X POST http://localhost:8081/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local","password":"AdminPass123!"}'
```
- Usar la cookie `JSESSIONID` para llamadas autenticadas:
```bash
curl -i -X GET http://localhost:8081/api/usuarios --cookie "JSESSIONID=<valor>"
```
- Forgot password:
```bash
curl -i -X POST http://localhost:8081/api/forgot-password -H "Content-Type: application/json" -d '{"email":"ana@example.com"}'
```

---
## 10. Buenas prácticas y próximos pasos (prioritarios)
1. Habilitar CSRF para formularios y tokens en front si se usan formularios stateful.
2. Forzar HTTPS y marcar cookies como `Secure` y `HttpOnly`.
3. Limitar sesiones por usuario (1 sesión activa) si se desea control de sesiones.
4. Migrar filtros a consultas JPA para eficiencia (paginación, índices DB).
5. Considerar JWT si migras a SPA con backend stateless.
6. Añadir `@ControllerAdvice` para manejo centralizado de errores.

---
## 11. Recursos para seguir aprendiendo
- Documentación Spring Boot: https://spring.io/projects/spring-boot
- Spring Security: https://spring.io/projects/spring-security
- BCrypt / jBCrypt: entender salt y cost (work factor)
- JPA & Hibernate: mapeo, cache y estrategias de fetch

---
He ampliado la guía con ejemplos prácticos, explicación línea a línea y una sección de errores comunes. Más abajo encontrarás detalles: ejemplos cURL con respuestas, un diagrama ASCII simple de la arquitectura, y una sección de "Errores comunes" con pasos concretos para resolverlos.

---

## ✅ Ejemplos cURL detallados (peticiones y respuestas esperadas)
A continuación hay ejemplos reales que puedes ejecutar desde la terminal. Ajusta `PORT` si cambias `server.port`.

### 1) Login (POST /api/login)
Request:
```bash
curl -i -X POST http://localhost:8081/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local","password":"AdminPass123!"}'
```
Respuesta (éxito, 200):
```json
{
  "success": true,
  "message": "Login correcto",
  "roles": ["ADMIN"],
  "isAdmin": true
}
```
Si credenciales inválidas -> 401 con `{ "success": false, "message": "Credenciales inválidas" }`.

### 2) Registro (POST /api/register)
Request:
```bash
curl -i -X POST http://localhost:8081/api/register \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Ana","apellido":"Lopez","email":"ana@example.com","password":"Secreta123","rol":"CLIENTE","especialidad":"Electrico"}'
```
Respuesta (éxito, 201):
```json
{ "success": true, "message": "Usuario registrado" }
```
Si email duplicado -> 409 con `{ "success": false, "message": "El correo ya existe" }`.

### 3) Forgot Password (POST /api/forgot-password)
Request:
```bash
curl -i -X POST http://localhost:8081/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com"}'
```
Respuesta (siempre 200 para no filtrar usuarios):
```json
{ "success": true, "message": "Si el correo existe, recibirás un email con instrucciones" }
```

### 4) Reset Password (POST /api/reset-password?token=...)
Request:
```bash
curl -i -X POST "http://localhost:8081/api/reset-password?token=<TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"NuevaClave123","confirmPassword":"NuevaClave123"}'
```
Respuesta (éxito): 200 `{ "success": true, "message": "Contraseña actualizada" }`

---

## 🧭 Diagrama simple de la arquitectura (ASCII)
```
Client (browser/JS)
    |
   HTTP
    v
Controllers (REST)  ---> Services ---> Repositories (JPA) ---> MySQL
    |                  ^
    |                  |
   Static assets       +-- Utilities (Password hashing, Email sender)
```

---

## 🔍 Explicación línea a línea — fragmentos importantes
A continuación explico fragmentos clave del código y por qué están así.

### SecurityConfig (resumen clave)
```java
@Bean
public PasswordEncoder passwordEncoder() {
  return new BCryptPasswordEncoder();
}
```
- `PasswordEncoder`: proporciona un wrapper para encriptar contraseñas. BCrypt añade salt y permite ajustar el coste.

```java
http.csrf(csrf -> csrf.disable())
  .authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/login","/api/register","/api/forgot-password").permitAll()
    .requestMatchers("/api/admin/**").hasRole("ADMIN")
    .anyRequest().authenticated()
  )
  .httpBasic();
```
- `csrf.disable()`: útil para APIs REST; si usas formularios protegidos por el servidor activa CSRF.
- `permitAll()`: rutas públicas.
- `hasRole("ADMIN")`: protege rutas admin. Spring espera roles sin prefijo `ROLE_` al usar `hasRole`.

### LoginController — flujo básico
```java
if (loginService.validarCredenciales(email, password)) {
  Authentication auth = new UsernamePasswordAuthenticationToken(email, null, authorities);
  SecurityContextHolder.getContext().setAuthentication(auth);
  request.getSession().setAttribute("SPRING_SECURITY_CONTEXT", SecurityContextHolder.getContext());
  return ResponseEntity.ok(Map.of("success", true, "roles", roles));
}
```
- Se genera un `Authentication` y se guarda en `SecurityContext`. Luego se persiste en la sesión HTTP para compatibilidad con sesiones stateful (útil para MockMvc y UI basada en cookies).

### RegisterService — pasos críticos
```java
if (usuarioRepository.findByEmail(newUser.getEmail()) != null) throw new IllegalStateException(...);
String hashed = passwordEncoder.encode(newUser.getPassword());
newUser.setPassword(hashed);
newUser.setActive(true);
Rol selected = rolRepository.findByNombre(rolNombre);
if (selected == null) throw new IllegalStateException(...);
usuarioRepository.save(newUser);
```
- Verificación de email único evita duplicados.
- `passwordEncoder.encode` hace el hash seguro.
- Validación del rol evita asignar roles inexistentes.

---

## 🚨 Errores comunes y cómo resolverlos (con ejemplos reales del proyecto)
1) NullPointerException en tests: `this.usuarioRepository` null
   - Causa: el servicio usaba inyección por campos y las pruebas usaban Mockito sin inyectar dependencias correctamente.
   - Solución: usar inyección por constructor en `RegisterService` y `@InjectMocks` en pruebas o inicializar con `new RegisterService(...)`.
2) `rawPassword cannot be null` al hashear
   - Causa: el test creó un `Usuario` sin `password` antes de llamar al método que la hashea.
   - Solución: en el test setear `newUser.setPassword("pw")` o validar inputs antes de hashear.
3) MockMvc y sesión no persistida
   - Causa: al autenticar manualmente no se guardó SecurityContext en session.
   - Solución: `request.getSession().setAttribute("SPRING_SECURITY_CONTEXT", SecurityContextHolder.getContext());` o utilizar `formLogin()` de Spring Security en tests.

---

## ✅ Resumen y próximos pasos sugeridos
- Lee la sección "Explicación línea a línea" para entender por qué cada elección fue tomada.
- Ejecuta los ejemplos cURL para ver las respuestas reales y practicar.
- Si quieres, puedo agregar ejemplos de `@WebMvcTest` y plantillas de pruebas unitarias adicionales.

---

¿Quieres que además incluya ejemplos de `@WebMvcTest` y plantillas de tests para `PasswordRecoveryService` y `CustomUserDetailsService`? Puedo agregarlos inmediatamente.

