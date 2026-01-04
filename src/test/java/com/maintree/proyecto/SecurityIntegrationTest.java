package com.maintree.proyecto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.maintree.proyecto.dao.RolRepository;
import com.maintree.proyecto.dao.UsuarioRepository;
import com.maintree.proyecto.model.Rol;
import com.maintree.proyecto.model.Usuario;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class SecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private RolRepository rolRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    public void setup() {
        // crear roles
        Rol admin = rolRepository.findByNombre("ADMIN");
        if (admin == null) {
            admin = new Rol();
            admin.setNombre("ADMIN");
            rolRepository.save(admin);
        }
        Rol cliente = rolRepository.findByNombre("CLIENTE");
        if (cliente == null) {
            cliente = new Rol();
            cliente.setNombre("CLIENTE");
            rolRepository.save(cliente);
        }

        // crear admin usuario
        Usuario adminUser = usuarioRepository.findByEmail("admin-test@local");
        if (adminUser == null) {
            adminUser = new Usuario();
            adminUser.setEmail("admin-test@local");
            adminUser.setPassword(passwordEncoder.encode("AdminPass123!"));
            adminUser.setIsActive(true);
            adminUser.setRoles(Collections.singleton(admin));
            usuarioRepository.save(adminUser);
        }

        // crear cliente usuario
        Usuario clienteUser = usuarioRepository.findByEmail("cliente-test@local");
        if (clienteUser == null) {
            clienteUser = new Usuario();
            clienteUser.setEmail("cliente-test@local");
            clienteUser.setPassword(passwordEncoder.encode("ClientePass123!"));
            clienteUser.setIsActive(true);
            clienteUser.setRoles(Collections.singleton(cliente));
            usuarioRepository.save(clienteUser);
        }
    }

    @Test
    public void whenNotAuthenticated_thenGetUsuariosUnauthorized() throws Exception {
        mockMvc.perform(get("/api/usuarios")).andExpect(status().isUnauthorized());
    }

    @Test
    public void loginAndAccess_thenOk() throws Exception {
        // login admin
        String content = mapper.writeValueAsString(Collections.singletonMap("email", "admin-test@local"));
        content = content.replace("}", ", \"password\": \"AdminPass123!\"}");
        MvcResult r = mockMvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON).content(content)).andExpect(status().isOk()).andReturn();
        MockHttpSession session = (MockHttpSession) r.getRequest().getSession(false);

        // now access protected endpoint with session
        mockMvc.perform(get("/api/usuarios").session(session)).andExpect(status().isOk());

        // try update usuario as admin -> should be allowed
        String updateJson = mapper.writeValueAsString(Collections.singletonMap("nombre", "NuevoNombre"));
        mockMvc.perform(put("/api/usuarios/1").contentType(MediaType.APPLICATION_JSON).content(updateJson).session(session)).andExpect(status().isOk());
    }

    @Test
    public void clientCannotUpdateUsuario_thenForbidden() throws Exception {
        // login cliente
        String content = mapper.writeValueAsString(Collections.singletonMap("email", "cliente-test@local"));
        content = content.replace("}", ", \"password\": \"ClientePass123!\"}");
        MvcResult r = mockMvc.perform(post("/api/login").contentType(MediaType.APPLICATION_JSON).content(content)).andExpect(status().isOk()).andReturn();
        MockHttpSession session = (MockHttpSession) r.getRequest().getSession(false);

        String updateJson = mapper.writeValueAsString(Collections.singletonMap("nombre", "NuevoNombre"));
        mockMvc.perform(put("/api/usuarios/1").contentType(MediaType.APPLICATION_JSON).content(updateJson).session(session)).andExpect(status().isForbidden());
    }
}
