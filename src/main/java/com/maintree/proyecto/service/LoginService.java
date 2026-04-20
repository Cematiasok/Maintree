package com.maintree.proyecto.service;

import com.maintree.proyecto.dao.UsuarioRepository;
import com.maintree.proyecto.model.Usuario;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class LoginService {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public boolean validarCredenciales(String email, String password) {
        try {
            System.out.println("Buscando usuario con email: " + email);
            Usuario usuario = usuarioRepository.findByEmail(email);

            if (usuario == null) {
                System.out.println("Usuario no encontrado para email: " + email);
                return false;
            }

            System.out.println("Usuario encontrado. Verificando estado activo...");
            Boolean isActive = usuario.getIsActive();
            if (!Boolean.TRUE.equals(isActive)) {
                System.out.println("Usuario no está activo");
                return false;
            }

            System.out.println("Usuario activo. Verificando contraseña...");
            String hashedPassword = usuario.getPassword();
            if (hashedPassword == null) {
                System.out.println("Error: contraseña almacenada es null");
                return false;
            }

            boolean result = passwordEncoder.matches(password, hashedPassword);
            System.out.println("Resultado de validación de contraseña: " + result);
            return result;
        } catch (Exception e) {
            System.err.println("Error en validación de credenciales: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }
}