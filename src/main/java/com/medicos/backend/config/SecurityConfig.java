package com.medicos.backend.config;

import com.medicos.backend.security.JwtAuthenticationFilter;
import com.medicos.backend.security.RateLimitingFilter;
import com.medicos.backend.security.TenantContextFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final TenantContextFilter tenantContextFilter;

    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
    private String allowedOrigins;

    /** Controls Swagger UI / OpenAPI doc exposure. Set SWAGGER_ENABLED=false in production. */
    @Value("${swagger.enabled:true}")
    private boolean swaggerEnabled;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          RateLimitingFilter rateLimitingFilter,
                          TenantContextFilter tenantContextFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.rateLimitingFilter = rateLimitingFilter;
        this.tenantContextFilter = tenantContextFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12); // work factor 12 (default 10)
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                .ignoringRequestMatchers(
                    "/api/auth/login",
                    "/api/auth/logout",
                    "/api/auth/register",
                    "/api/trial/signup",
                    "/api/super-admin/unlock",
                    "/api/mobile/**"
                )
                .ignoringRequestMatchers(request -> {
                    String authHeader = request.getHeader("Authorization");
                    return authHeader != null && authHeader.startsWith("Bearer ");
                })
            )
            .headers(headers -> headers

                // ── Clickjacking protection ──────────────────────────────────
                .frameOptions(frame -> frame.deny())

                // ── XSS protection ───────────────────────────────────────────
                // Note: modern browsers use CSP instead, but keep this for older clients
                .xssProtection(xss -> xss.disable()) // deprecated header; CSP is the correct control

                // ── MIME sniffing protection ──────────────────────────────────
                .contentTypeOptions(ct -> {})

                // ── HSTS (HTTPS enforcement) ──────────────────────────────────
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31_536_000)
                    .preload(true)
                )

                // ── Content Security Policy ────────────────────────────────────
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
                        "https://cdn.tailwindcss.com https://cdn.jsdelivr.net; " +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                    "font-src 'self' https://fonts.gstatic.com data:; " +
                    "img-src 'self' data: blob: https:; " +
                    "connect-src 'self' ws: wss: http: https:; " +
                    "frame-src 'self' data: blob:; " +
                    "object-src 'self' data: blob:; " +
                    "frame-ancestors 'none';"  // equivalent to X-Frame-Options: DENY
                ))

                // ── Referrer policy ───────────────────────────────────────────
                .referrerPolicy(referrer -> referrer
                    .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))

                // ── Permissions policy ────────────────────────────────────────
                // Restricts sensitive browser APIs while allowing microphone for voice dictation
                .permissionsPolicy(pp -> pp.policy(
                    "geolocation=(), camera=(), microphone=(self), payment=(), usb=(), " +
                    "accelerometer=(), gyroscope=(), magnetometer=()"
                ))
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Authentication is required to access this endpoint.\"}");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\":\"Forbidden\",\"message\":\"Access denied for your role or hospital tenant.\"}");
                })
            )
            .authorizeHttpRequests(auth -> {
                auth
                    // ── Static assets (EMR frontend SPA) ─────────────────────
                    .requestMatchers(
                        "/", "/index.html", "/favicon.ico",
                        "/*.jpg", "/*.jpeg", "/*.png", "/*.svg", "/*.ico", "/*.json",
                        "/manifest.webmanifest", "/*.webmanifest",
                        "/static/**", "/css/**", "/js/**", "/assets/**", "/fonts/**",
                        "/portal/**", "/app/**", "/doctor/**", "/patient/**",
                        "/admin/**", "/super-admin/**", "/_vercel/**",
                        "/sw.js", "/registerSW.js", "/workbox-*.js", "/error"
                    ).permitAll()

                    // ── Authentication endpoints ──────────────────────────────
                    // Register is admin-only — hospital assignment must come from a verified admin session
                    .requestMatchers(HttpMethod.POST, "/api/auth/register").hasRole("ADMIN")
                    .requestMatchers("/api/auth/**").permitAll()

                    // ── System / health ───────────────────────────────────────
                    .requestMatchers("/api/health").permitAll()
                    .requestMatchers("/api/system/**").permitAll()

                    // ── Super admin unlock (uses secret key in service layer) ──
                    .requestMatchers(HttpMethod.POST, "/api/super-admin/unlock").permitAll()

                    // ── Prescription public slip (token-based public link) ─────
                    .requestMatchers("/api/prescriptions/slip/**").permitAll()

                    // ── Patient app public endpoints ──────────────────────────
                    .requestMatchers("/api/mobile/doctors", "/api/mobile/doctors/**").permitAll()
                    .requestMatchers("/api/mobile/health-tips").permitAll()

                    // ── Swagger / OpenAPI (disabled in production via env var) ─
                    .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html")
                    .access((authentication, context) -> {
                        // Always allow OPTIONS for CORS preflight
                        if (context.getRequest().getMethod().equals("OPTIONS")) {
                            return new org.springframework.security.authorization.AuthorizationDecision(true);
                        }
                        boolean allowed = swaggerEnabled;
                        return new org.springframework.security.authorization.AuthorizationDecision(allowed);
                    })

                    // ── CORS preflight ────────────────────────────────────────
                    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                    // ── Everything else requires authentication ────────────────
                    .anyRequest().authenticated();
            })
            .addFilterBefore(tenantContextFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Parse comma-separated origins from env var
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
        configuration.setAllowedOrigins(origins);

        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList(
                "Authorization", "Content-Type", "X-CSRF-Token",
                "X-Requested-With", "Accept", "X-Hospital-Code"));
        configuration.setExposedHeaders(List.of("X-Request-Id")); // allows clients to read request IDs
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
