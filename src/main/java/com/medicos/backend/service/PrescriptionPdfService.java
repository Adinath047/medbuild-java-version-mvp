package com.medicos.backend.service;

import com.medicos.backend.dto.PrescriptionPdfData;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Entities;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

@Service
public class PrescriptionPdfService {

    private final TemplateEngine templateEngine;

    public PrescriptionPdfService(TemplateEngine templateEngine) {
        this.templateEngine = templateEngine;
    }

    /**
     * Renders src/main/resources/templates/prescription.html with the given
     * data and converts the result into a PDF byte array.
     */
    public byte[] generatePdf(PrescriptionPdfData data) throws IOException {
        Context context = new Context();
        context.setVariable("hospitalName", data.getHospitalName());
        context.setVariable("hospitalTagline", data.getHospitalTagline());
        context.setVariable("hospitalAddress", data.getHospitalAddress());
        context.setVariable("hospitalPhone", data.getHospitalPhone());
        context.setVariable("doctorName", data.getDoctorName());
        context.setVariable("doctorQualification", data.getDoctorQualification());
        context.setVariable("secondDoctorName", data.getSecondDoctorName());
        context.setVariable("secondDoctorQualification", data.getSecondDoctorQualification());
        context.setVariable("patientName", data.getPatientName());
        context.setVariable("patientMeta", data.getPatientMeta());
        context.setVariable("visitDateTime", data.getVisitDateTime());
        context.setVariable("bp", data.getBp());
        context.setVariable("pulse", data.getPulse());
        context.setVariable("heightCm", data.getHeightCm());
        context.setVariable("weightKg", data.getWeightKg());
        context.setVariable("bmi", data.getBmi());
        context.setVariable("complaints", data.getComplaints());
        context.setVariable("history", data.getHistory());
        context.setVariable("investigations", data.getInvestigations());
        context.setVariable("diagnosis", data.getDiagnosis());
        context.setVariable("systemicExamination", data.getSystemicExamination());
        context.setVariable("medicines", data.getMedicines());
        context.setVariable("advice", data.getAdvice());
        context.setVariable("followUp", data.getFollowUp());
        context.setVariable("doctorSignName", data.getDoctorSignName());
        context.setVariable("doctorSignQualification", data.getDoctorSignQualification());

        // 1. Render the Thymeleaf template into a raw HTML string.
        String renderedHtml = templateEngine.process("prescription", context);

        // 2. Clean it into strict, well-formed XHTML.
        Document jsoupDoc = Jsoup.parse(renderedHtml);
        jsoupDoc.outputSettings()
                .syntax(Document.OutputSettings.Syntax.xml)
                .escapeMode(Entities.EscapeMode.xhtml);
        String xhtml = jsoupDoc.html();

        // 3. Convert the XHTML into a PDF.
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(xhtml, null);
            builder.toStream(outputStream);
            builder.run();
            return outputStream.toByteArray();
        }
    }
}
