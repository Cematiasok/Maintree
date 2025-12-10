# MaintreeApp

Aplicación Spring Boot para gestionar usuarios (ABM) con autenticación, registro, recuperación de contraseña por correo y panel de administración. Este README explica cómo levantar el proyecto y cómo funciona hoy; luego se irán sumando funcionalidades más interesantes.

## Requisitos
- JDK 22+
- Maven 3.9+
- MySQL 8.x en local
- Mailhog (opcional) para probar envío de correos en desarrollo
- PowerShell o Bash para ejecutar comandos

## Configuración rápida
1) Base de datos
- Crea la BD: `CREATE DATABASE maintreebd;`
- Ajusta credenciales en `src/main/resources/application.properties` si no usas `root` sin contraseña:
	- `spring.datasource.url=jdbc:mysql://localhost:3306/maintreebd`
	- `spring.datasource.username=...`
	- `spring.datasource.password=...`

2) Correo (local con Mailhog)
- Ejecuta Mailhog desde la raíz (Windows): `./mailhog.exe`
- UI de Mailhog: http://localhost:8025
- La app usa host `localhost` y puerto `1025` (configurable en `application.properties`).

3) Admin seeder (solo para dev)
- Por defecto `admin.create=true` crea un rol ADMIN y un usuario `admin@local` con password `AdminPass123!` al arrancar.
- Desactívalo en entornos reales con `admin.create=false` o variable de entorno `ADMIN_CREATE=false`.

## Cómo ejecutar
Desde la raíz del repo:

- Arrancar directamente con Maven (puerto por defecto `8081`):
	```powershell
	mvn spring-boot:run
	```

- O empaquetar y correr el JAR:
	```powershell
	mvn -DskipTests package
	java -jar target\maintreeApp-*.jar
	```

Visita `http://localhost:8081/` para la UI pública y `http://localhost:8081/user-admin.html` para el panel (requiere rol ADMIN).

## Qué hay hoy (ABM)
- Registro y login de usuarios (contraseñas hasheadas).
- Recuperación y reseteo de contraseña via email con token con expiración.
- ABM de usuarios y roles desde `user-admin.html` (activar/desactivar, editar, asignar rol).
- Rol por defecto `CLIENTE` configurable (`app.default.role`).

## Estructura útil
- Código Java: `src/main/java/com/maintree/proyecto/`
	- Controladores: `controller/`
	- Servicios: `service/`
	- Repositorios: `dao/`
	- Configuración y seeder: `config/`
- Frontend estático: `src/main/resources/static/` (`index.html`, `user-admin.html`, JS/CSS).
- Configuración: `src/main/resources/application.properties`
- SQL de sincronización de datos: `src/main/resources/db/migration_sync.sql`

## Tips y problemas comunes
- Si la app no levanta: revisa conexión MySQL y el puerto `server.port=8081`.
- Si no llegan correos: confirma Mailhog en host `localhost` y puerto `1025`.
- Cambia las credenciales del seeder antes de exponer la app.

## Próximos pasos
- Nuevas funcionalidades sobre el ABM actual (p. ej., permisos más granulares, reportes, flujos adicionales). Si necesitas priorizar algo, avísame.