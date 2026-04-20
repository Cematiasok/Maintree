# 📚 Aprende Maintree: Guía para Implementar este Proyecto desde Cero

Esta guía te enseña a **pensar y codificar** como ingeniero software, paso a paso. El objetivo es que en tu próximo proyecto, no necesites ayuda de IA: entiendas **por qué** se hace cada cosa.

> **Estado del proyecto:** Spring Boot 4.0.5 · Java 25 · Hibernate 7 · Spring Security 7 · Spring Framework 7

---

## 🏛️ Parte 1: Arquitectura y Decisiones de Diseño

### ¿Qué es Maintree?

Un **sistema de gestión de usuarios** con autenticación y autorización. Permite:
- Registro de usuarios
- Login seguro con contraseñas hasheadas
- Recuperación de contraseña por email
- Panel de administración para gestionar usuarios y roles

**¿Por qué es importante entender esto?** Porque necesitas saber qué problema resuelves ANTES de escribir una línea de código.

### Arquitectura por capas

Maintree sigue el **patrón de capas** (Layers Pattern) — el más común en aplicaciones empresariales:

```
┌─────────────────────────────────────────┐
│         PRESENTACIÓN (Frontend)         │
│  HTML/CSS/JS - login.html, etc.         │
└────────────────┬────────────────────────┘
                 │ HTTP (JSON)
┌────────────────▼────────────────────────┐
│     CONTROLADORES (Controllers)         │
│  LoginController, RegisterController    │
│  - Reciben requests HTTP                │
│  - Validan entrada                      │
│  - Delegan al servicio                  │
└────────────────┬────────────────────────┘
                 │ Llamadas Java
┌────────────────▼────────────────────────┐
│    SERVICIOS (Services)                 │
│  LoginService, RegisterService          │
│  - Lógica de negocio                    │
│  - Orquestación de datos                │
│  - Decisiones del dominio               │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│  REPOSITORIOS (Data Access Objects)     │
│  UsuarioRepository                      │
│  - Consultas a base de datos            │
│  - Transformación de datos              │
└────────────────┬────────────────────────┘
                 │ SQL
┌────────────────▼────────────────────────┐
│     BASE DE DATOS (MySQL)               │
│  Tablas: usuarios, roles, permisos      │
└─────────────────────────────────────────┘
```

#### ¿Por qué separar en capas?

| Beneficio | Razón |
|-----------|-------|
| **Mantenibilidad** | Si cambias la BD, solo toca Repository. Si cambias lógica, solo toca Service |
| **Testabilidad** | Cada capa se prueba independientemente (inyección de dependencias) |
| **Escalabilidad** | Fácil agregar features sin tocar código existente |
| **Responsabilidad única** | Cada clase hace UNA cosa bien |

---

## 💾 Parte 2: Estructura de Datos y Base de Datos

### Modelo conceptual

```
┌─────────────────┐         ┌─────────────┐
│    USUARIO      │────────│     ROL     │
├─────────────────┤   N:M  ├─────────────┤
│ id (PK)         │         │ id (PK)     │
│ nombre          │────────│ nombre      │
│ apellido        │         │ descripción │
│ email (UNIQUE)  │         └─────────────┘
│ password (hash) │
│ isActive        │         ┌──────────────┐
│ resetToken      │────────│   PERMISO    │
└─────────────────┘   1:N   ├──────────────┤
                             │ id (PK)      │
                             │ nombre       │
                             │ descripción  │
                             └──────────────┘
```

### Tablas SQL

#### `usuarios`
```sql
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    apellido VARCHAR(100),
    email VARCHAR(100) UNIQUE NOT NULL,
    especialidad VARCHAR(100),
    password VARCHAR(255) NOT NULL,  -- Hash BCrypt (~60 chars)
    isActive BOOLEAN DEFAULT FALSE,
    reset_token VARCHAR(255) NULL,
    reset_token_expiry DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Decisiones:**
- `email UNIQUE`: Cada usuario debe tener un email único
- `password VARCHAR(255)`: BCrypt hash es largo (~60 chars), así que 255 es seguro
- `isActive`: Track si el usuario fue aprobado por admin
- `reset_token`: Para reseteo seguir de contraseña (temporal, debe expirar)

#### `roles`
```sql
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT
);
```

#### `usuariorol` (Tabla de unión para relación N:M)
```sql
CREATE TABLE usuariorol (
    usuario_id INT NOT NULL,
    rol_id INT NOT NULL,
    PRIMARY KEY (usuario_id, rol_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
);
```

---

## 🔐 Parte 3: Seguridad — Lo Más Crítico

### ¿Por qué no guardar contraseñas en texto plano?

❌ **MAL** (NUNCA):
```java
usuarios.put(email, password);  // ¡Desastre de seguridad!
```

✅ **BIEN**:
```java
String hashedPassword = passwordEncoder.encode(password);  // BCrypt con salt
usuarios.put(email, hashedPassword);
```

### BCrypt: Hash con Salt

**BCrypt** es el estándar para contraseñas. ¿Por qué?

1. **Salt automático**: Cada hash incluye un salt único → mismo password, hashes diferentes
2. **Función lenta**: Tardanza deliberada (por defecto, rounds=10) → imposible fuerza bruta
3. **Verificación segura**: `passwordEncoder.matches(plain, hash)` — Spring lo hace internamente

> ⚠️ Antes usábamos la librería `jbcrypt` (abandonada). Hoy Spring Security ya trae `BCryptPasswordEncoder` incluido. **Nunca agregues librerías externas para hashing de passwords si Spring Security ya está en el proyecto.**

```java
// Spring Security provee BCryptPasswordEncoder:
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();  // rounds=10 por defecto
}

// Guardar (en RegisterService o AdminSeeder):
String hashedPassword = passwordEncoder.encode("MiPassword123");
// Resultado: $2a$10$... (63 chars, incluye salt + hash)

// Verificar (en LoginService):
boolean valido = passwordEncoder.matches("MiPassword123", hashedPassword);
```

### Spring Security: Control de Acceso

Spring Security maneja **autenticación** (¿quién eres?) y **autorización** (¿qué podés hacer?).

#### CORS en Spring Security (Spring Framework 7 / Boot 4)

**¿Por qué no usar `WebMvcConfigurer.addCorsMappings()`?**
En Spring Framework 7, ese método fue deprecado. Y más importante: si CORS se configura a nivel MVC, Spring Security lo procesa **después** del filtro de seguridad — lo que puede causar que preflight requests (OPTIONS) sean rechazadas antes de llegar al MVC.

La forma correcta es un `@Bean` de `CorsConfigurationSource` + `.cors()` en el chain:

```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())  // Lee el bean CorsConfigurationSource
            .csrf(csrf -> csrf.disable())      // Para APIs REST
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/login", "/api/register").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .httpBasic(Customizer.withDefaults());
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

**Explícito línea a línea:**
- `.cors(Customizer.withDefaults())`: Le dice a Security que use el `CorsConfigurationSource` bean
- `.csrf().disable()`: Para APIs REST sin forms HTML (en apps con forms: activar CSRF)
- `permitAll()`: Sin autenticación
- `hasRole("ADMIN")`: Solo usuarios con rol ADMIN
- `authenticated()`: Cualquier usuario autenticado
- `SessionCreationPolicy.IF_REQUIRED`: Crea sesión solo cuando hay login (no crea sesiones anónimas)

---

## 🎯 Parte 4: Implementación por Capas

### 4.1 CAPA MODELO (Entity/Domain)

El modelo representa la **realidad del negocio** en código:

```java
@Entity
@Table(name = "usuarios")
public class Usuario {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;  // Auto-increment por BD
    
    @Column(name = "email", unique = true, nullable = false)
    private String email;  // UNIQUE en BD
    
    @Column(name = "password", nullable = false)
    private String password;  // Hash BCrypt
    
    @Column(name = "isActive")
    private Boolean isActive;  // Requiere aprobación admin

    // LocalDateTime en lugar de Date — Hibernate 7 lo mapea nativo a TIMESTAMP
    // ⚠️ NUNCA uses @Temporal con Date en Hibernate 7+ — está deprecado
    @Column(name = "reset_token_expiry")
    private LocalDateTime resetTokenExpiry;
    
    // OJO: Relación N:M
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "usuariorol",
        joinColumns = @JoinColumn(name = "usuario_id"),
        inverseJoinColumns = @JoinColumn(name = "rol_id")
    )
    private Set<Rol> roles = new HashSet<>();
    
    public Usuario() {
        this.roles = new HashSet<>();
        this.isActive = false;  // Default: no activo hasta que admin apruebe
    }
    
    // Getters y setters...
}
```

**Decisiones importantes:**
- `@Entity`: Marca que esta clase se mapea a una tabla (ORM = Object-Relational Mapping)
- `@ManyToMany`: Un usuario puede tener múltiples roles, un rol múltiples usuarios
- `FetchType.EAGER`: Trae roles inmediatamente al cargar usuario (vs. LAZY = bajo demanda)
- `HashSet<Rol>`: Evita duplicados automáticamente
- `LocalDateTime` (no `Date`): Java Time API moderna — Hibernate 7 mapea a `TIMESTAMP` sin `@Temporal`

### 4.2 CAPA ACCESO A DATOS (Repository/DAO)

Responsable SOLO de consultas y transformación de datos:

```java
@Repository  // Spring la reconoce como bean
public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {
    
    // Spring genera la SQL automáticamente del nombre del método:
    Usuario findByEmail(String email);  // SELECT * FROM usuarios WHERE email = ?
    
    // Búsqueda más compleja:
    @Query("SELECT u FROM Usuario u WHERE u.isActive = true")
    List<Usuario> findAllActive();
}
```

**Sin Spring Data JPA**, tendrías que escribir:
```java
// ❌ Viejo estilo (JDBC):
String sql = "SELECT * FROM usuarios WHERE email = ?";
PreparedStatement stmt = connection.prepareStatement(sql);
stmt.setString(1, email);
ResultSet rs = stmt.executeQuery();
// ... mapear ResultSet a objeto Usuario manualmente
```

**Con Spring Data JPA** ✅:
```java
Usuario usuario = usuarioRepository.findByEmail(email);  // Una línea!
```

### 4.3 CAPA SERVICIO (Business Logic)

Aquí vive la **lógica de negocio** — decisiones del dominio:

```java
@Service  // Spring bean
public class LoginService {
    
    @Autowired
    private UsuarioRepository usuarioRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    /**
     * Valida credenciales de un usuario.
     * 
     * Lógica de negocio:
     * 1. ¿Existe el usuario?
     * 2. ¿La contraseña es correcta?
     * 3. ¿El usuario está activo (aprobado por admin)?
     */
    public boolean validarCredenciales(String email, String password) {
        Usuario usuario = usuarioRepository.findByEmail(email);
        
        // Validación 1: Existe
        if (usuario == null) {
            return false;
        }
        
        // Validación 2: Contraseña correcta
        boolean passwordValida = passwordEncoder.matches(password, usuario.getPassword());
        if (!passwordValida) {
            return false;
        }
        
        // Validación 3: Usuario activo
        if (!usuario.getIsActive()) {
            return false;  // Admin aún no lo aprobó
        }
        
        return true;
    }
}
```

**¿Por qué aquí y no en Controller?**
- **Testeable**: Pruebas inyectando mock de Repository
- **Reutilizable**: Si hay otro cliente (CLI, API diferente), reutilizas la lógica
- **Mantenible**: Si cambia la lógica, cambias SIN afectar presentation layer

### 4.4 CAPA CONTROLADOR (REST API)

Responsable de:
1. Recibir requests HTTP
2. Validar entrada (¿el JSON es válido?)
3. Delegar al servicio
4. Formatear respuesta

```java
@RestController  // API REST (vs @Controller para views HTML)
@RequestMapping("/api")
@CrossOrigin(origins = "*")  // CORS para frontend
public class LoginController {
    
    @Autowired
    private LoginService loginService;
    
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Usuario usuario) {
        try {
            // Validar entrada
            if (usuario.getEmail() == null || usuario.getPassword() == null) {
                return ResponseEntity.badRequest().body(
                    Map.of("success", false, "message", "Email y password requeridos")
                );
            }
            
            // Delegar al servicio
            boolean valido = loginService.validarCredenciales(
                usuario.getEmail(), 
                usuario.getPassword()
            );
            
            if (valido) {
                // Respuesta de éxito
                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Login exitoso",
                    "roles", usuario.getRoles().stream()
                        .map(Rol::getNombre)
                        .toList()
                ));
            } else {
                // Respuesta de error
                return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "Credenciales inválidas"
                ));
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "message", "Error interno: " + e.getMessage()
            ));
        }
    }
}
```

**Responsabilidades:**
- ✅ Parsear request
- ✅ Validar entrada
- ✅ Llamar servicio
- ✅ Formatear respuesta
- ❌ NO hacer lógica de negocio

---

## 🧪 Parte 5: Testing — Cómo Validar tu Código

### ¿Por qué tests?

Imagina que cambiaste la lógica de login. ¿Cómo sabes que no rompiste nada?
- ❌ Clickeando manualmente: Lento, error-prone, no escala
- ✅ Tests automáticos: Rápido, confiable, se integra en CI/CD

### Tipos de tests

| Tipo | Scope | Velocidad | Dependencias |
|------|-------|-----------|--------------|
| **Unitario** | Una clase/método | Muy rápido | Mock de dependencias |
| **Integración** | Service + Repository + BD | Rápido | BD en memoria (H2) |
| **E2E (End-to-End)** | API + Frontend + BD real | Lento | Servidor real |

### Test Unitario: LoginService

```java
@RunWith(MockitoJUnitRunner.class)  // Spring crea mocks automáticamente
public class LoginServiceTest {
    
    @Mock
    private UsuarioRepository usuarioRepository;  // Mock = simulado
    
    @Mock
    private PasswordEncoder passwordEncoder;
    
    @InjectMocks  // Inyecta los mocks en el servicio
    private LoginService loginService;
    
    @Test
    public void debeRetornarFalsoSiUsuarioNoExiste() {
        // Arrange (preparar): Mockear que no existe usuario
        when(usuarioRepository.findByEmail("no@existe.com")).thenReturn(null);
        
        // Act (actuar): Llamar el método
        boolean resultado = loginService.validarCredenciales("no@existe.com", "pass");
        
        // Assert (afirmar): Validar resultado
        assertFalse(resultado);
    }
    
    @Test
    public void debeRetornarFalsoSiContraseñaIncorrecta() {
        // Arrange
        Usuario usuarioMock = new Usuario();
        usuarioMock.setEmail("user@example.com");
        usuarioMock.setPassword("$2a$10$hashedPassword123");  // Hash BCrypt
        usuarioMock.setIsActive(true);
        
        when(usuarioRepository.findByEmail("user@example.com")).thenReturn(usuarioMock);
        when(passwordEncoder.matches("contraseniaIncorrecta", usuarioMock.getPassword()))
            .thenReturn(false);  // Mockear que no coincide
        
        // Act
        boolean resultado = loginService.validarCredenciales("user@example.com", "contraseniaIncorrecta");
        
        // Assert
        assertFalse(resultado);
    }
    
    @Test
    public void debeRetornarTruoSiCredencialesCorrectas() {
        // Arrange
        Usuario usuarioMock = new Usuario();
        usuarioMock.setEmail("admin@local");
        usuarioMock.setPassword("$2a$10$hashedPassword123");
        usuarioMock.setIsActive(true);
        
        when(usuarioRepository.findByEmail("admin@local")).thenReturn(usuarioMock);
        when(passwordEncoder.matches("AdminPass123!", usuarioMock.getPassword()))
            .thenReturn(true);
        
        // Act
        boolean resultado = loginService.validarCredenciales("admin@local", "AdminPass123!");
        
        // Assert
        assertTrue(resultado);
    }
}
```

### Test de Integración: LoginController

```java
@SpringBootTest
@AutoConfigureMockMvc  // Simula requests HTTP sin servidor real
public class LoginIntegrationTest {
    
    @Autowired
    private MockMvc mockMvc;  // Cliente HTTP simulado
    
    @Autowired
    private UsuarioRepository usuarioRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @BeforeEach
    public void setup() {
        // Crear usuario de test en BD
        Usuario usuario = new Usuario();
        usuario.setEmail("test@example.com");
        usuario.setPassword(passwordEncoder.encode("TestPass123!"));
        usuario.setIsActive(true);
        usuarioRepository.save(usuario);
    }
    
    @Test
    public void loginDebeRetornarSuccessTrueConCredencialesValidas() throws Exception {
        mockMvc.perform(post("/api/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"test@example.com\",\"password\":\"TestPass123!\"}")
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.message").value("Inicio de sesión correcto"));
    }
    
    @Test
    public void loginDebeRetornarFalsoConCredencialesInvalidas() throws Exception {
        mockMvc.perform(post("/api/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"test@example.com\",\"password\":\"WrongPassword\"}")
        )
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.success").value(false));
    }
}
```

**Cómo ejecutar:**
```bash
mvn test                                    # Todos los tests
mvn -Dtest=LoginServiceTest test            # Solo LoginServiceTest
mvn -Dtest=LoginServiceTest#debeRetorna* test  # Solo test específico
```

---

## 🛠️ Parte 6: Flujos Completos — De Idea a Código

### Flujo 1: Registro de Usuario

```
Frontend (register.html)
    ↓
POST /api/register con {nombre, apellido, email, password, especialidad}
    ↓
RegisterController.register()
    ├─ Validar que email no exista (Repository.findByEmail)
    ├─ Hashear contraseña (PasswordEncoder)
    ├─ Crear usuario inactivo (isActive=false)
    └─ Guardar en BD (Repository.save)
    ↓
Response: {"success": true, "message": "Registro exitoso. Espera aprobación"} (201 Created)
```

**Código que escribirías:**

```java
// RegisterService
@Service
public class RegisterService {
    
    @Autowired
    private UsuarioRepository usuarioRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    public Usuario registrar(Usuario nuevoUsuario) throws Exception {
        // Validación 1: Email único
        if (usuarioRepository.findByEmail(nuevoUsuario.getEmail()) != null) {
            throw new Exception("Email ya registrado");
        }
        
        // Validación 2: Contraseña válida
        if (nuevoUsuario.getPassword() == null || nuevoUsuario.getPassword().length() < 8) {
            throw new Exception("Contraseña debe tener mínimo 8 caracteres");
        }
        
        // Crear usuario
        nuevoUsuario.setPassword(passwordEncoder.encode(nuevoUsuario.getPassword()));
        nuevoUsuario.setIsActive(false);  // Requiere aprobación admin
        
        return usuarioRepository.save(nuevoUsuario);
    }
}

// RegisterController
@RestController
@RequestMapping("/api")
public class RegisterController {
    
    @Autowired
    private RegisterService registerService;
    
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Usuario usuario) {
        try {
            Usuario registrado = registerService.registrar(usuario);
            return ResponseEntity.status(201).body(Map.of(
                "success", true,
                "message", "Registro exitoso. Un administrador debe aprobar tu cuenta."
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "Error en registro: " + e.getMessage()
            ));
        }
    }
}
```

### Flujo 2: Recuperación de Contraseña

```
Frontend (btn "¿Olvidaste tu contraseña?")
    ↓
POST /api/forgot-password con {email}
    ↓
ForgotPasswordService
    ├─ Buscar usuario por email
    ├─ Generar token aleatorio temporal (UUID)
    ├─ Guardar token + expiry (30 min desde ahora) en BD
    ├─ Enviar email con link: /reset-password.html?token=...
    └─ Response: "Email enviado"
    ↓
Usuario hace click en email → Llena nuevo password
    ↓
POST /api/reset-password con {token, newPassword}
    ↓
ResetPasswordService
    ├─ Buscar usuario por token
    ├─ Validar token no expirado
    ├─ Hashear nueva contraseña
    ├─ Guardar contraseña nueva
    ├─ Borrar token
    └─ Response: "Contraseña actualizada"
```

---

## 🚀 Parte 7: Stack Tecnológico — ¿Por Qué Esta Combinación?

| Tecnología | Versión | Por qué | Alternativa |
|-----------|---------|--------|---------|
| **Spring Boot** | 4.0.5 | Framework estándar industria, productivo, comunidad enorme | Quarkus, Micronaut |
| **Java** | 25 | LTS moderno, records, pattern matching, virtual threads | — |
| **JPA/Hibernate** | 7.x | ORM estándar Java, Hibernate 7 elimina `@Temporal`, mejora `LocalDateTime` | MyBatis, jOOQ |
| **Spring Security** | 7.x | Autenticación/autorización battle-tested, `CorsConfigurationSource` integrado | Apache Shiro, Auth0 |
| **MySQL Connector/J** | 9.6.0 | Última versión estable, soporte completo MySQL 8 | — |
| **MySQL** | 8.x | BD relacional estable, ampliamente soportada | PostgreSQL, MariaDB |
| **Maven** | 3.9+ | Build tool estándar, gestión de dependencias | Gradle |
| **JUnit 5 + Mockito** | (via Boot) | Testing estándar Java | TestNG, AssertJ |

---

## 🔄 Parte 8: Lo que Cambió al Migrar a Spring Boot 4 — Y Por Qué Importa

Entender las migraciones te hace mejor programador. Acá está el resumen de qué cambió y el razonamiento:

### Spring Boot 4 / Spring Framework 7: Cambios reales en este proyecto

| Antes (Boot 3.x) | Ahora (Boot 4.x) | Razón |
|---|---|---|
| `spring-boot-starter-web` | `spring-boot-starter-webmvc` | Boot 4 separó `webmvc` de `webflux` — más explícito |
| `import com.fasterxml.jackson` | `import tools.jackson` | Jackson 3 cambió el group ID completamente |
| `@MockBean` / `@SpyBean` (Spring) | `@Mock` / `@Spy` (Mockito puro) | Spring removió sus propios wrappers — usá Mockito directamente |
| `WebMvcConfigurer.addCorsMappings()` | `CorsConfigurationSource @Bean` | El método fue deprecado en Framework 7 — CORS va en Security |
| `@Temporal(TIMESTAMP) + Date` | `LocalDateTime` sin anotación | Hibernate 7 deprecó `@Temporal` — la Java Time API es nativa |
| `org.hibernate.dialect.H2Dialect` en properties | (sin esa property) | Hibernate 7 autodetecta el dialect — declararlo manualmente genera warning |
| `import ...boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc` | `import ...boot.webmvc.test.autoconfigure.AutoConfigureMockMvc` | En Boot 4, el test de WebMVC tiene su propio módulo separado |

### Lección clave

> Los frameworks evolucionan. Lo importante no es memorizar las APIs — es saber **cómo investigar**: leer el migration guide oficial, inspeccionar los jars con `jar tf`, usar `javap -verbose` para ver annotations deprecadas. Esas son las herramientas de un programador real.

---

## 📋 Parte 9: Checklist para tu Próximo Proyecto

Cuando hagas el próximo proyecto SIN ayuda de IA, verifica:

### Análisis
- [ ] ¿Entiendo el problema de negocio?
- [ ] ¿Definí mi modelo de datos (entidades, relaciones)?
- [ ] ¿Dibujé el diagrama entidad-relación (ER)?

### Arquitectura
- [ ] ¿Separé en capas (Controller → Service → Repository)?
- [ ] ¿Cada capa tiene una responsabilidad única?
- [ ] ¿Inyecté dependencias correctamente (@Autowired)?

### Base de Datos
- [ ] ¿Creé las tablas con PRIMARY KEY, FOREIGN KEY?
- [ ] ¿Validé UNIQUE, NOT NULL donde corresponde?
- [ ] ¿Usa AUTO_INCREMENT para IDs?

### Seguridad
- [ ] ¿Hasheo contraseñas con BCrypt (NO texto plano)?
- [ ] ¿Valido entrada en cada endpoint?
- [ ] ¿Protejo endpoints sensibles con @PreAuthorize?
- [ ] ¿Evito inyección SQL (siempre uso JPA o prepared statements)?

### Código
- [ ] ¿Sin lógica de negocio en Controllers?
- [ ] ¿Sin SQL directo en código (uso ORM)?
- [ ] ¿Nombres de variables/métodos claros y descriptivos?
- [ ] ¿Manejo excepciones adecuadamente?

### Testing
- [ ] ¿Tests unitarios para lógica crítica (Services)?
- [ ] ¿Tests de integración para flujos completos?
- [ ] ¿Cobertura mínima del 70%?
- [ ] ¿Todos los tests pasan antes de commit?

---

## 🎓 Recursos para Profundizar

### Fundamentos
- Spring Boot docs: https://spring.io/projects/spring-boot
- JPA/Hibernate: https://hibernate.org/orm/
- Spring Security: https://spring.io/projects/spring-security

### Seguridad
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- BCrypt explicado: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### Arquitectura
- Clean Architecture: Robert C. Martin
- Domain-Driven Design: Eric Evans
- Arquitectura hexagonal: Alistair Cockburn

---

## 💭 Reflexión Final

Este proyecto tiene **100 líneas relevantes**. No es cantidad, es **calidad de decisiones**. 

Cuando escribas tu próximo proyecto:
1. **Piensa primero**: Modelado, arquitectura, seguridad
2. **Divide responsabilidades**: Capas, inyección, interfaces
3. **Prueba todo**: Tests unitarios + integración + E2E
4. **Documenta decisiones**: Por qué elegiste MySQL vs PostgreSQL, por qué BCrypt, etc.

Eso hace la diferencia entre un "junior que sabe copypastear" y un "ingeniero que entiende sistemas".

¡Adelante! 🚀
