package com.medicos.backend.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WebViewController {

    /**
     * Forwards root URL and any frontend SPA routes to index.html
     */
    @GetMapping({"/", "/portal/**", "/app/**", "/doctor/**", "/patient/**", "/admin/**"})
    public String index() {
        return "forward:/index.html";
    }
}
