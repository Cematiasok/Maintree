package com.maintree.proyecto.service;

import com.maintree.proyecto.dao.UsuarioRepository;
import com.maintree.proyecto.model.Usuario;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mindrot.jbcrypt.BCrypt;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoginServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @InjectMocks
    private LoginService loginService;

    @Test
    void validarCredenciales_ok() {
        Usuario u = new Usuario();
        u.setEmail("test@local");
        u.setPassword(BCrypt.hashpw("secret", BCrypt.gensalt()));
        u.setIsActive(true);

        when(usuarioRepository.findByEmail("test@local")).thenReturn(u);

        boolean ok = loginService.validarCredenciales("test@local", "secret");
        assertTrue(ok);
    }

    @Test
    void validarCredenciales_usuarioNoEncontrado() {
        when(usuarioRepository.findByEmail("missing@local")).thenReturn(null);
        assertFalse(loginService.validarCredenciales("missing@local", "any"));
    }

    @Test
    void validarCredenciales_usuarioInactivo() {
        Usuario u = new Usuario();
        u.setEmail("inactive@local");
        u.setPassword(BCrypt.hashpw("x", BCrypt.gensalt()));
        u.setIsActive(false);
        when(usuarioRepository.findByEmail("inactive@local")).thenReturn(u);

        assertFalse(loginService.validarCredenciales("inactive@local", "x"));
    }

    @Test
    void validarCredenciales_passwordIncorrecta() {
        Usuario u = new Usuario();
        u.setEmail("user@local");
        u.setPassword(BCrypt.hashpw("correct", BCrypt.gensalt()));
        u.setIsActive(true);
        when(usuarioRepository.findByEmail("user@local")).thenReturn(u);

        assertFalse(loginService.validarCredenciales("user@local", "wrong"));
    }
}