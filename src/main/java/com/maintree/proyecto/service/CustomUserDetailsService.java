package com.maintree.proyecto.service;

import com.maintree.proyecto.dao.UsuarioRepository;
import com.maintree.proyecto.model.Usuario;
import com.maintree.proyecto.model.Rol;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    public CustomUserDetailsService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Usuario usuario = usuarioRepository.findByEmail(username);
        if (usuario == null) {
            throw new UsernameNotFoundException("Usuario no encontrado: " + username);
        }
        if (!Boolean.TRUE.equals(usuario.getIsActive())) {
            throw new UsernameNotFoundException("Usuario no activo: " + username);
        }
        List<SimpleGrantedAuthority> authorities = usuario.getRoles().stream()
                .map(Rol::getNombre)
                .map(nombre -> "ROLE_" + nombre)
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());

        return new org.springframework.security.core.userdetails.User(usuario.getEmail(), usuario.getPassword(), authorities);
    }
}