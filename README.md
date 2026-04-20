# Maintree — Backend API

Sistema de gestión de usuarios para entornos industriales. Provee autenticación, autorización por roles, recuperación de contraseña y panel de administración vía API REST.

---

## Stack tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| **Java** | 25 | Lenguaje |
| **Spring Boot** | 4.0.5 | Framework principal |
| **Spring Security** | (via Boot) | Autenticación y autorización |
| **Spring Data JPA / Hibernate** | 7.x | ORM — acceso a datos |
| **MySQL Connector/J** | 9.6.0 | Driver de base de datos |
| **MySQL** | 8.x | Base de datos de producción |
| **H2** | (via Boot) | BD en memoria — solo para tests |
| **Maven** | 3.9+ | Build y dependencias |
| **MailHog** | local | SMTP capturador para pruebas de email |
| **JUnit 5 + Mockito** | (via Boot) | Testing |

---

## Requisitos previos

- **JDK 25** con `JAVA_HOME` apuntando a ella
- **Maven 3.9+**
- **MySQL 8.x** corriendo localmente

> Si tenés múltiples JDKs, verificá con `java -version` y `mvn -version` que ambos usen JDK 25.

---

## Configuración inicial

### 1. Base de datos

```sql
CREATE DATABASE maintreebd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Editá `src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/maintreebd
spring.datasource.username=root
spring.datasource.password=TU_PASSWORD
```

> Las tablas se crean automáticamente (Hibernate DDL `update`).

### 2. Admin inicial (solo desarrollo)

Ya configurado en `application.properties`:

```properties
admin.create=true
admin.email=admin@local
admin.password=AdminPass123!
```

Al iniciar crea el admin si no existe. En producción: `admin.create=false`.

### 3. Email — MailHog (opcional)

```powershell
# En otra terminal, desde la raíz del proyecto:
.\mailhog.exe
# UI: http://localhost:8025
```

---

## Ejecutar

```powershell
# Si JAVA_HOME no apunta a JDK 25, sobrescribilo en la sesión:
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"

# Ejecutar en desarrollo
mvn spring-boot:run
```

API disponible en: **http://localhost:8081**

---

## Tests

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"

mvn test                                    # Todos los tests
mvn test -Dtest=LoginServiceTest            # Solo unitarios de Login
mvn test -Dtest=SecurityIntegrationTest     # Solo integración
```

Los tests usan **H2 en memoria** — no requieren MySQL.

---

## Endpoints

### Públicos (sin autenticación)

| Método | URL | Body | Descripción |
|---|---|---|---|
| `POST` | `/api/register` | `{email, password, nombre, apellido, especialidad}` | Registra usuario (queda inactivo hasta aprobación admin) |
| `POST` | `/api/login` | `{email, password}` | Autenticación — establece sesión HTTP |
| `POST` | `/api/forgot-password` | `{email}` | Envía email con link de reset |
| `POST` | `/api/reset-password` | `{token, newPassword}` | Establece nueva contraseña |

### Autenticados (cualquier rol)

| Método | URL | Descripción |
|---|---|---|
| `GET` | `/api/usuarios` | Lista todos los usuarios |
| `PUT` | `/api/usuarios/{id}` | Actualiza datos de un usuario |
| `GET` | `/api/roles` | Lista roles disponibles |

### Solo ADMIN

| Método | URL | Descripción |
|---|---|---|
| `PUT` | `/api/admin/usuarios/{id}/approve` | Aprueba o desactiva un usuario |

---

## Cómo funciona

### Arquitectura por capas

```
HTTP Request
    ↓
[Controller]   recibe el request, valida entrada, delega
    ↓
[Service]      lógica de negocio y decisiones del dominio
    ↓
[Repository]   acceso a datos (JPA genera el SQL)
    ↓
[MySQL]
```

### Flujo de autenticación

1. `POST /api/login` con `{email, password}`
2. Spring Security llama a `CustomUserDetailsService` — carga el usuario desde BD
3. `LoginService` verifica: ¿existe? → ¿password matchea el hash BCrypt? → ¿está activo?
4. Si pasa: Spring crea sesión HTTP devuelta en cookie `JSESSIONID`
5. Requests siguientes envían esa cookie — Spring valida automáticamente

### Seguridad

- **Contraseñas:** BCrypt (10 rounds, salt automático) — nunca texto plano
- **CORS:** `CorsConfigurationSource` bean — procesado por Security antes del MVC
- **Autorización:** reglas en `SecurityFilterChain` + `@EnableMethodSecurity`

### Recuperación de contraseña

1. `POST /api/forgot-password` → token UUID guardado en BD con expiración `LocalDateTime` (+1 hora)
2. Email con link `?token=...` enviado al usuario (capturado por MailHog en dev)
3. `POST /api/reset-password` → valida token + expiración → hashea y guarda nueva contraseña → borra token

---

## Generar JAR (producción)

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"
mvn -DskipTests package
java -jar target/maintree-1.0-SNAPSHOT.jar
```

> Antes de producción: `admin.create=false` y configurar SMTP real.

---

Leé [aprende.md](aprende.md) para entender la arquitectura y cómo replicar este proyecto sin ayuda de IA.