---
page: bed-allocation
project_id: medicos-emr-v1
provider: Google Stitch MCP
---

# Google Stitch UI Prompt: Bed Allocation & Vitals Board

Generate a clean, high-density hospital Bed Allocation & Vitals Monitoring dashboard for Medicos EMR.

**DESIGN SYSTEM (REQUIRED):**
- Primary Accent: Deep Teal `#0f766e`
- Layout: Header with title, top action buttons with SVG vector icons (Add Bed, View History, Refresh), Main Stats summary card, double-row filter bar (Wards & Status).
- Bed Cards: Grid layout containing room/ward name, occupancy status badge (Available/Occupied), patient info, vitals tiles (BP, HR, SpO2, Temp, Sugar), warning banner for overdue observations, and action buttons.
- Strict Constraints: Zero emojis. All icons rendered via clean SVG paths.
