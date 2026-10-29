# 📄 Invoicely | Ledger Pro

A fast, offline-first, and beautifully designed Invoice Generator & Client Ledger. Built entirely with **Vanilla HTML, CSS, and JavaScript** (No heavy frameworks required). 

Designed with an "Anti-AI-Slop" technical control panel aesthetic, featuring high data density, strict grid systems, and a seamless mobile experience.

![Invoicely Banner](https://img.shields.io/badge/Version-2.0-blue) ![Tech](https://img.shields.io/badge/Tech-Vanilla%20JS-yellow) ![Status](https://img.shields.io/badge/Status-Active-success)

## ✨ Features

- **📱 Mobile-First Architecture:** Fully responsive with a dedicated bottom navigation bar for mobile devices, and a sidebar layout for desktops.
- **🔒 Offline-First:** All data (Invoices, Clients, Settings) is saved securely in your browser's `localStorage`. No database or server needed.
- **📊 Analytics Dashboard:** Built-in SVG charts to visualize your revenue over the last 6 months.
- **👥 Client Directory (CRM):** Save clients once and auto-fill their details in future invoices using a dropdown.
- **🎨 5 Custom Templates:** Choose from Modern, Classic, Minimal, Bold, and Dark Tech layouts.
- **⌨️ Command Palette:** Press `Ctrl + K` (or `Cmd + K`) to instantly navigate, create invoices, or export data using the keyboard.
- **🖨️ Perfect PDF Printing:** A dedicated `@media print` stylesheet ensures your invoices look perfect on A4 paper (hides all UI buttons).
- **🔄 Auto-Overdue Tracking:** Pending invoices are automatically flagged as "Overdue" (with a red pulse animation) if the date has passed.
- **📥 Data Export:** Export your entire ledger as CSV or download a JSON backup for safekeeping.

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (CSS Variables, Flexbox, Grid)
- **Logic:** Vanilla ES6+ JavaScript
- **Storage:** `localStorage` API
- **Icons:** Custom inline SVGs
- **Fonts:** Space Grotesk & IBM Plex Sans (Google Fonts)

## 🚀 How to Run Locally

Since this project has zero dependencies and requires no build step, running it is incredibly simple:

1. Clone the repository:
   ```bash
   https://sarfazali0098-spec.github.io/Invoicely-Ledger-Pro/
