package com.maintree.proyecto.service;

import com.maintree.proyecto.dao.RolRepository;
import com.maintree.proyecto.dao.UsuarioRepository;
import com.maintree.proyecto.model.Rol;
import com.maintree.proyecto.model.Usuario;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RegisterServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private RolRepository rolRepository;

    @Spy
    private PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @InjectMocks
    private RegisterService registerService;

    @SuppressWarnings("null")
    @Test
    void registerUser_success() throws SQLException {
        Usuario newUser = new Usuario();
        newUser.setEmail("new@e");
        newUser.setPassword("rawpw");

        when(usuarioRepository.findByEmail("new@e")).thenReturn(null);
        Rol r = new Rol(); r.setNombre("CLIENTE");
        when(rolRepository.findByNombre("CLIENTE")).thenReturn(r);

        boolean result = registerService.registerUser(newUser, "CLIENTE");
        assertTrue(result);

        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository).save(captor.capture());
        Usuario saved = captor.getValue();
        assertNotNull(saved.getPassword());
        assertNotEquals("rawpw", saved.getPassword());
        assertTrue(passwordEncoder.matches("rawpw", saved.getPassword()));
        assertTrue(saved.getIsActive());
    }

    @SuppressWarnings("null")
    @Test
    void registerUser_duplicateEmailThrows() {
        Usuario newUser = new Usuario(); newUser.setEmail("dup@e");
        when(usuarioRepository.findByEmail("dup@e")).thenReturn(new Usuario());

        assertThrows(IllegalStateException.class, () -> registerService.registerUser(newUser, "CLIENTE"));
        verify(usuarioRepository, never()).save(any());
    }

    @SuppressWarnings("null")
    @Test
    void registerUser_missingRoleThrows() {
        Usuario newUser = new Usuario(); newUser.setEmail("x@e"); newUser.setPassword("pw");
        when(usuarioRepository.findByEmail("x@e")).thenReturn(null);
        when(rolRepository.findByNombre("NONEXISTENT")).thenReturn(null);

        assertThrows(IllegalStateException.class, () -> registerService.registerUser(newUser, "NONEXISTENT"));
        verify(usuarioRepository, never()).save(any());
    }
}