package com.maintree.proyecto.controller;

import com.maintree.proyecto.dto.ForgotPasswordRequest;
import com.maintree.proyecto.service.PasswordRecoveryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
@RestController
@RequestMapping("/api")
public class ForgotPasswordController {

    private final PasswordRecoveryService recoveryService;

    public ForgotPasswordController(PasswordRecoveryService recoveryService) {
        this.recoveryService = recoveryService;
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest usuarioRequest, BindingResult bindingResult, HttpServletRequest request) {
        if (bindingResult.hasErrors()) {
            Map<String, Object> responseMap = new HashMap<>();
            responseMap.put("success", false);
            responseMap.put("message", "Correo inválido o formato incorrecto.");
            return ResponseEntity.badRequest().body(responseMap);
        }
        String email = usuarioRequest.getEmail();
        String requestUrl = request.getRequestURL().toString();
        Map<String, Object> responseMap = new HashMap<>();

        try {
            recoveryService.initiatePasswordReset(email, requestUrl);
            responseMap.put("success", true);
            responseMap.put("message", "Si tu correo está registrado, recibirás un enlace de recuperación.");
            return ResponseEntity.ok(responseMap);
        } catch (Exception e) {
            e.printStackTrace();
            responseMap.put("success", false);
            responseMap.put("message", "Hubo un error al procesar tu solicitud: " + e.getMessage());
            return new ResponseEntity<>(responseMap, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
