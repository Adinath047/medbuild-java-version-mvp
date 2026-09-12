package com.medicos.backend.fhir.config;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.server.RestfulServer;
import ca.uhn.fhir.rest.server.interceptor.CorsInterceptor;
import com.medicos.backend.fhir.provider.MedbuildsCapabilityStatementProvider;
import com.medicos.backend.fhir.provider.PatientResourceProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;

/**
 * Registers the HAPI FHIR R4 {@link RestfulServer} as a Spring servlet at {@code /fhir/r4/*}.
 *
 * <p>Construction order is deliberately explicit to avoid a Spring circular dependency:
 * <ol>
 *   <li>{@link FhirContext} singleton is created first (no dependencies).</li>
 *   <li>{@link PatientResourceProvider} is a normal {@code @Component} bean.</li>
 *   <li>{@link RestfulServer} is built here with the provider already injected.</li>
 *   <li>{@link MedbuildsCapabilityStatementProvider} is constructed <em>after</em> the server,
 *       passing the server reference — this is why it is not a {@code @Component}.</li>
 *   <li>The capability statement provider is set on the server before servlet registration.</li>
 * </ol>
 * </p>
 */
@Configuration
public class FhirServerConfig {

    @Value("${app.base-url:http://localhost:8080}")
    private String baseUrl;

    /**
     * Shared, singleton FHIR R4 context.  Construction is expensive (~1–2 s) so this
     * must be a Spring singleton bean — never call {@code FhirContext.forR4()} inside
     * a request-scoped path.
     */
    @Bean
    public FhirContext fhirContext() {
        return FhirContext.forR4();
    }

    /**
     * Registers the HAPI {@link RestfulServer} mapped to {@code /fhir/r4/*}.
     * Spring Boot's embedded Tomcat picks this up via {@link ServletRegistrationBean}.
     */
    @Bean
    public ServletRegistrationBean<RestfulServer> fhirServletRegistration(
            FhirContext fhirContext,
            PatientResourceProvider patientResourceProvider) {

        RestfulServer server = new RestfulServer(fhirContext);

        // ── Phase 1 providers: Patient only ───────────────────────────────────
        server.setResourceProviders(patientResourceProvider);

        // ── Capability statement (constructed after server to break circular dep)
        MedbuildsCapabilityStatementProvider capabilityProvider =
            new MedbuildsCapabilityStatementProvider(server, baseUrl);
        server.setServerConformanceProvider(capabilityProvider);

        // ── Response format ────────────────────────────────────────────────────
        server.setDefaultResponseEncoding(ca.uhn.fhir.rest.api.EncodingEnum.JSON);
        server.setDefaultPrettyPrint(false);

        // ── CORS for FHIR paths ────────────────────────────────────────────────
        // SMART App Launch clients require unauthenticated preflight to /fhir/r4/metadata
        CorsInterceptor corsInterceptor = new CorsInterceptor();
        CorsConfiguration corsConfig = new CorsConfiguration();
        corsConfig.addAllowedHeader("Accept");
        corsConfig.addAllowedHeader("Content-Type");
        corsConfig.addAllowedHeader("Authorization");
        corsConfig.addAllowedHeader("X-Requested-With");
        corsConfig.addAllowedOriginPattern("*");
        corsConfig.addAllowedMethod("GET");
        corsConfig.addAllowedMethod("POST");
        corsConfig.addAllowedMethod("OPTIONS");
        corsConfig.setAllowCredentials(false);
        corsInterceptor.setConfig(corsConfig);
        server.registerInterceptor(corsInterceptor);

        ServletRegistrationBean<RestfulServer> registration =
            new ServletRegistrationBean<>(server, "/fhir/r4/*");
        registration.setName("fhirServlet");
        registration.setLoadOnStartup(1);
        return registration;
    }
}
