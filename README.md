# 🩺 Medicos Hospital EMR — Java Spring Boot Backend

Complete production-ready Java backend for the **Medicos EMR Application**, built using **Spring Boot 3**, **Spring Security (JWT)**, **Spring Data JPA**, and **PostgreSQL**.

---

## 🚀 Key Features

- **Framework**: Spring Boot 3.2.3 (Java 17+)
- **Database**: PostgreSQL (JDBC: `jdbc:postgresql://localhost:5432/medicos_db`)
- **Authentication**: JWT (JSON Web Tokens) with HttpOnly Cookie support & CORS pre-flight authorization
- **Database Initialization**: Auto schema creation and default seeding (`schema.sql`)
- **Frontend Compatible**: Fully matches all Node `/api/...` REST endpoints expected by the React frontend

---

## 🛠️ Prerequisites

Ensure you have the following installed on your system:
- **Java JDK**: 17 or higher (tested with OpenJDK 24)
- **Apache Maven**: 3.8+
- **PostgreSQL**: 13 or higher running locally on port 5432

---

## 🗄️ Database Setup (PostgreSQL)

Before running the application, create the PostgreSQL database:

```bash
# Connect to PostgreSQL via psql
psql -U postgres

# Create the database
CREATE DATABASE medicos_db;
```

> **Note**: Default credentials in `application.properties` are set to `username=postgres` and `password=postgres`. If your PostgreSQL credentials differ, update `/src/main/resources/application.properties`.

---

## 📦 Build & Compilation

To clean and compile the project using Maven:

```bash
cd /Users/apple/Desktop/Medicos/medicos-java-backend
mvn clean compile
```

To build a standalone executable JAR package:

```bash
mvn clean package -DskipTests
```

---

## ▶️ Running the Java Backend

Run directly with Maven:

```bash
mvn spring-boot:run
```

Or run the built JAR:

```bash
java -jar target/medicos-java-backend-1.0.0.jar
```

The backend server will start at:  
👉 **`http://localhost:8080/api`**

---

## 🔗 Connecting with Existing React Frontend

To connect your existing React frontend (`/Users/apple/Desktop/Medicos/Medicos`) to this Java backend:

1. Open `/Users/apple/Desktop/Medicos/Medicos/.env` (or create it) and set:
   ```env
   VITE_API_URL=http://localhost:8080/api
   ```
2. Or update your `vite.config.ts` proxy to route `/api` to `http://localhost:8080`:
   ```ts
   server: {
     proxy: {
       '/api': {
         target: 'http://localhost:8080',
         changeOrigin: true,
       }
     }
   }
   ```
3. Start the frontend:
   ```bash
   cd /Users/apple/Desktop/Medicos/Medicos/client
   npm run dev
   ```

---

## 🔑 Default Credentials

- **Super Admin**: `adinathmade@medicos.com` | Password: `admin123`
- **Doctor**: `doctor@medicos.com` | Password: `doc12345`

---

## 📡 REST API Summary

| Category | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/login` | `POST` | Authenticate user & get JWT token |
| **Auth** | `/api/auth/me` | `GET` | Get current logged in user profile |
| **Auth** | `/api/auth/register` | `POST` | Register a new user |
| **Patients** | `/api/patients` | `GET` / `POST` | List & search patients or create new patient |
| **Patients** | `/api/patients/{id}` | `GET` / `PUT` | Get or update patient details |
| **Patients** | `/api/patients/{id}/summary` | `GET` | Full EMR summary (encounters, vitals, rx, etc.) |
| **Vitals** | `/api/vitals` | `GET` / `POST` | Get vitals history or record new vitals |
| **Prescriptions** | `/api/prescriptions` | `GET` / `POST` | Fetch or issue digital prescriptions |
| **Prescriptions** | `/api/prescriptions/slip/{token}` | `GET` | Public digital prescription slip lookup |
| **Appointments** | `/api/appointments` | `GET` / `POST` | Manage patient appointments |
| **Beds** | `/api/beds` | `GET` / `POST` | Manage hospital wards and bed allocations |
| **Billing** | `/api/billing` | `GET` / `POST` | Manage invoice and payment receipts |
| **Medicines** | `/api/medicines` | `GET` / `POST` | Pharmacy catalog search |
| **Notifications** | `/api/notifications/active` | `GET` | Fetch unread system notifications |
| **System** | `/api/health` | `GET` | Health check & PostgreSQL connection status |

---

## 📂 Project Directory Structure

```
medicos-java-backend/
├── pom.xml
├── README.md
└── src/
    └── main/
        ├── java/com/medicos/backend/
        │   ├── MedicosJavaBackendApplication.java
        │   ├── config/
        │   │   └── SecurityConfig.java
        │   ├── security/
        │   │   ├── JwtTokenProvider.java
        │   │   └── JwtAuthenticationFilter.java
        │   ├── dto/
        │   │   ├── AuthDTO.java
        │   │   └── PatientDTO.java
        │   ├── entity/
        │   │   ├── User.java
        │   │   ├── Hospital.java
        │   │   ├── Patient.java
        │   │   ├── Encounter.java
        │   │   ├── Vital.java
        │   │   ├── Prescription.java
        │   │   ├── Appointment.java
        │   │   ├── Bed.java
        │   │   ├── BedAdmission.java
        │   │   ├── Billing.java
        │   │   ├── Medicine.java
        │   │   ├── Notification.java
        │   │   └── PatientUpload.java
        │   ├── repository/
        │   │   └── [JPA Repositories]
        │   └── controller/
        │       └── [REST Controllers]
        └── resources/
            ├── application.properties
            └── schema.sql
```
