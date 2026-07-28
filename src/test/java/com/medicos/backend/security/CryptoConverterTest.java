package com.medicos.backend.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class CryptoConverterTest {

    private CryptoConverter cryptoConverter;

    @BeforeEach
    public void setUp() {
        cryptoConverter = new CryptoConverter("k9Xf2P7mN4qZ8vL3wY5rT1bC6jH0sD4fG7uI2oK8pQ0=");
    }

    @Test
    public void testEncryptAndDecryptRoundTrip() {
        String plainText = "Aadhaar-1234-5678-9012";
        String dbData = cryptoConverter.convertToDatabaseColumn(plainText);

        assertNotNull(dbData);
        assertTrue(dbData.startsWith("ENC:"));
        assertNotEquals(plainText, dbData);

        String decryptedText = cryptoConverter.convertToEntityAttribute(dbData);
        assertEquals(plainText, decryptedText);
    }

    @Test
    public void testLegacyUnencryptedDataFallback() {
        String legacyPlainText = "LegacyUnencryptedPatientId123";
        String decrypted = cryptoConverter.convertToEntityAttribute(legacyPlainText);
        assertEquals(legacyPlainText, decrypted);
    }

    @Test
    public void testNullAndEmptyStringHandling() {
        assertNull(cryptoConverter.convertToDatabaseColumn(null));
        assertNull(cryptoConverter.convertToEntityAttribute(null));
        assertEquals("", cryptoConverter.convertToDatabaseColumn(""));
        assertEquals("", cryptoConverter.convertToEntityAttribute(""));
    }
}
