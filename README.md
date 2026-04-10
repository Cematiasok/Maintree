# Maintree

Aplicación Spring Boot para gestionar usuarios (registro, login, recuperación de contraseña, panel de administración) con autenticación segura.

## Requisitos
- **JDK 21** o superior
- **Maven 3.9** o superior  
- **MySQL 8.x**
- **Mailhog** (opcional, para pruebas de correo en local)

## Configuración rápida

### 1. Base de datos
```bash
mysql -u root -p
CREATE DATABASE maintreebd;
```
Configura credenciales en `src/main/resources/application.properties`:
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/maintreebd
spring.datasource.username=root
spring.datasource.password=tu_password
```

### 2. Correo (Mailhog - opcional)
```powershell
# En otra terminal:
.\mailhog.exe
# UI: http://localhost:8025
```

### 3. Admin inicial (dev only)
En `application.properties`:
```properties
admin.create=true
admin.email=admin@local
admin.password=AdminPass123!
```

## Ejecutar

```bash
# Compilar y tests
mvn test

# Ejecutar en desarrollo
mvn spring-boot:run

# Generar JAR
mvn -DskipTests package
java -jar target/maintree-1.0-SNAPSHOT.jar
```

Accede en: **http://localhost:8081**

## Endpoints principales

- `POST /api/register` - Registro
- `POST /api/login` - Autenticación  
- `POST /api/forgot-password` - Reset de contraseña
- `GET /api/admin/usuarios` - Listar usuarios (ADMIN only)

## Aprender

Lee [aprende.md](aprende.md) para entender la arquitectura y cómo fue construido, con el objetivo de que puedas replicar este proyecto de forma independiente.