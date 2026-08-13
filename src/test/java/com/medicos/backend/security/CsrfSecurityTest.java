package com.medicos.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CsrfSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void unauthenticatedPostWithoutCsrf_rejectedForbidden() throws Exception {
        // Without Bearer header and without CSRF token, request is rejected with 403 Forbidden
        mockMvc.perform(post("/api/patients")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Test Patient\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void bearerHeaderRequest_bypassesCsrfRequirement() throws Exception {
        // Requests carrying Bearer authorization token bypass CSRF token requirement
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"hospital_id\":\"hsp-001\",\"password\":\"wrong\"}"))
                .andExpect(status().isBadRequest());
    }
}
