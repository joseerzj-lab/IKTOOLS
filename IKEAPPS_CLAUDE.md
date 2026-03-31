# IKEAPPS - Technical Documentation Overview

This document provides a comprehensive breakdown of the **IKEAPPS** project, designed to give another AI agent (like Claude) full context of the codebase, its architecture, and its specialized logistics tools.

## 🚀 Project Overview
**IKEAPPS** is a suite of specialized tools developed for IKEA logistics operations. It focuses on route planning, auditing, and data synchronization between multiple legacy Excel files and a modern React-based interface.

### Tech Stack
- **Framework:** React 19 (Vite)
- **Language:** TypeScript
- **Styling:** CSS-in-JS (DS-Tokens), TailwindCSS 4, Framer Motion (Animations)
- **Data Handling:** `xlsx` (Excel processing), `react-leaflet` (Mapping)
- **State Management:** React Hooks (Context + LocalState)
- **Deployment:** GitHub Pages (Joseerzj-lab/IKTOOLS)

---

## 🛠️ Main Modules & Pages

### 1. Ruteo PM (RuteadorV9)
The core route planning engine. It synchronizes legacy logic with a modern UI.
- **Functionality:** Handles massive data paste/parsing (TSV), duplicate ISO detection, and dynamic management assignment.
- **Key Files:** `RuteadorV9.tsx`, `TabLoad.tsx`, `TabDashboard.tsx`, `TabTemplates.tsx`.
- **Special Logic:** 
    - `COMENTARIO_RAW` handling for data consistency.
    - Automated "Gestion" assignment (Repite, Leslie, K8).
    - Email template generation with HTML table formatting (Aptos font, specific IKEA colors).

### 2. Auditoría de Rutas
Tools for verifying route compliance and performance.
- **Functionality:** Comparison between "Plan" and "Real" files, off-route detection, and commune mismatch validation.
- **Key Files:** `AuditoriaRutas.tsx`, `TabRoutePlan.tsx`.

### 3. Reporte de Rutas
Visualizing and reporting metrics.
- **Functionality:** Recharts-based dashboards, Metropolitan Region filters, and "ISOs por Camion" tab.
- **Key Files:** `ReporteRutas.tsx`.

### 4. Herramientas Geográficas
- **ConsultorISOs:** Search for specific units and their status.
- **ISOsFaltantesGeo:** Mapping missing units using Leaflet.

---

## 📐 Design Philosophy & UI
- **Glassmorphism:** Premium "Glass/Card" design system defined in `DS.tsx` and `ThemeContext.tsx`.
- **Theme Awareness:** Dual-mode (Light/Dark) support via `TC` (Theme Colors) tokens.
- **Micro-interactions:** Extensive use of `framer-motion` for tab transitions, hover states, and "toast" notifications.
- **Productivity First:** Heavy focus on keyboard shortcuts (Ctrl+C/V/?) and TSV (Tab-Separated Values) processing to bridge the gap with Excel.

---

## 🏗️ Architecture & Patterns

### Data Normalization
The project uses a standard `normalizeHeader` utility across most modules to handle inconsistencies in Excel headers (e.g., stripping accents, uppercase conversion).

### Component Structure
- `src/components/ui/DS.tsx`: Main design system components (Card, Btn, etc.).
- `src/components/[Module]`: Encapsulated module-specific tabs.
- `src/hooks`: Global utilities like `useTableSelection.ts` (Excel-like multi-select).

### Persistence
Heavy use of `localStorage` to preserve work-in-progress data (ISOs, columns, visibility) across sessions.

---

## 📋 Note for Claude
When working on this codebase:
1.  **Respect the Logic:** The logic in `RuteadorV9` is matched with a legacy HTML version. Do not alter data mapping rules without explicit user request.
2.  **Maintain the Design:** Always use the `TC` tokens from theme context for colors. Avoid hardcoding hex values.
3.  **Performance:** Be mindful of table size; the project often handles 500+ rows of data in memory.
