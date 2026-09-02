package com.medicos.backend.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WebViewController {

    /**
     * Forwards root URL and any frontend SPA routes to index.html.
     * IMPORTANT: /accept-invite/** must be listed here so that email invite links
     * (which are fresh page loads, not client-side navigations) get served the React
     * app rather than a 404 or blank page from Spring's static resource handler.
     */
    @GetMapping({"/", "/portal/**", "/app/**", "/doctor/**", "/patient/**", "/admin/**", "/accept-invite/**"})
    public String index() {
        return "forward:/index.html";
    }
}
