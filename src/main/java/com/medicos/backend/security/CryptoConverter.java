package com.medicos.backend.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * JPA AttributeConverter implementing Application-Layer Field Encryption (AES-256-GCM)
 * for sensitive PII/PHI fields before database persistence.
 */
@Converter
public class CryptoConverter implements AttributeConverter<String, String> {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int TAG_LENGTH_BIT = 128;
    private static final int IV_LENGTH_BYTE = 12;
    private static final String ENC_PREFIX = "ENC:";

    // Default 256-bit AES Key (Base64) - can be overridden via ENCRYPTION_KEY env var
    private static final String DEFAULT_KEY_BASE64 = "k9Xf2P7mN4qZ8vL3wY5rT1bC6jH0sD4fG7uI2oK8pQ0=";
    
    private final SecretKey key;
    private final SecureRandom secureRandom = new SecureRandom();

    public CryptoConverter() {
        String base64Key = System.getenv("ENCRYPTION_KEY");
        if (base64Key == null || base64Key.isBlank()) {
            base64Key = DEFAULT_KEY_BASE64;
        }
        byte[] decodedKey = Base64.getDecoder().decode(base64Key);
        this.key = new SecretKeySpec(decodedKey, 0, decodedKey.length, "AES");
    }

    public CryptoConverter(String base64SecretKey) {
        byte[] decodedKey = Base64.getDecoder().decode(base64SecretKey);
        this.key = new SecretKeySpec(decodedKey, 0, decodedKey.length, "AES");
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null || attribute.isBlank()) {
            return attribute;
        }
        // Avoid double encryption if already prefixed
        if (attribute.startsWith(ENC_PREFIX)) {
            return attribute;
        }
        try {
            byte[] iv = new byte[IV_LENGTH_BYTE];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(TAG_LENGTH_BIT, iv);
            cipher.init(Cipher.ENCRYPT_MODE, key, parameterSpec);

            byte[] cipherText = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));

            ByteBuffer byteBuffer = ByteBuffer.allocate(iv.length + cipherText.length);
            byteBuffer.put(iv);
            byteBuffer.put(cipherText);

            return ENC_PREFIX + Base64.getEncoder().encodeToString(byteBuffer.array());
        } catch (Exception e) {
            throw new RuntimeException("Error encrypting field at application layer", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return dbData;
        }
        // Support backward compatibility for unencrypted legacy rows
        if (!dbData.startsWith(ENC_PREFIX)) {
            return dbData;
        }

        try {
            String encodedPayload = dbData.substring(ENC_PREFIX.length());
            byte[] decoded = Base64.getDecoder().decode(encodedPayload);
            ByteBuffer byteBuffer = ByteBuffer.wrap(decoded);

            byte[] iv = new byte[IV_LENGTH_BYTE];
            byteBuffer.get(iv);

            byte[] cipherText = new byte[byteBuffer.remaining()];
            byteBuffer.get(cipherText);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(TAG_LENGTH_BIT, iv);
            cipher.init(Cipher.DECRYPT_MODE, key, parameterSpec);

            byte[] plainText = cipher.doFinal(cipherText);
            return new String(plainText, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Error decrypting field at application layer", e);
        }
    }
}
