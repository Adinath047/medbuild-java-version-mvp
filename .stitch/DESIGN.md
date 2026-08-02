# Medicos EMR — Google Stitch Design System

## 1. Visual Aesthetics & Token Architecture
- **Primary Accent**: `#0f766e` (Deep Emerald Teal)
- **Primary Light**: `#f0fdf4` / `#e6f4f1`
- **Surface**: `#ffffff` (Card background)
- **Background**: `#f8fafc` (Slate 50 background canvas)
- **Borders**: `1px solid #e2e8f0` (Crisp Slate 200 border line)
- **Text Primary**: `#0f172a` (Slate 900)
- **Text Muted**: `#64748b` (Slate 500)
- **Border Radius**: `12px` cards, `8px` inputs, `20px` badges/pills

## 2. Iconography & Directives
- **Zero Emojis**: Do NOT use raw emoji characters (`🏥`, `🛏️`, `📋`, `💊`, `⚠️`).
- **Icons**: Use clean vector SVG icons exclusively (`stroke="currentColor"`, `strokeWidth="2"`).
- **Typography**: Inter / Noto Sans tabular numbers, high contrast, clean weight hierarchy.

## 3. UI Component Primitives
- **Badges**: Pill-shaped with subtle light background tints and 700 font weight.
- **Tables**: Border-bottom row separators, compact padding (`10px 14px`), uppercase column headers.
- **Buttons**: Flat solid primary buttons (`#0f766e`), ghost secondary buttons with border.
