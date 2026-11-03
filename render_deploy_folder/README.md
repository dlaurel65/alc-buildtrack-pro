# BuildTrack Pro - Automated Logic Edition
### Enterprise Project Management Platform for Commercial Controls & Building Automation

Built specifically for Building Automation Systems (BAS), controls contractors, commissioning authorities (CxA), and project managers running complex commercial projects (hospitals, data centers, universities, high-rises).

---

## 🎯 Production Modules Included

1. **📅 Project Schedules & Field Calendar Engine**
   - **Month Calendar Grid**: Interactive visual month planner with day cells, today highlight, and previous/next month navigation.
   - **Activity Detail Inspector**: 1-click inspection of trade assignment, start/end dates, duration, % completion bar, predecessor dependencies, and 1-tap "Mark as Done (100%)" toggle.
   - **3-Week Subcontractor Lookahead**: Structured into *This Week*, *Next Week*, and *Future Lookahead* for field superintendents and subcontractor coordination meetings.
   - **Gantt Waterfall Timeline**: Tabular task breakdown with progress tracking, critical path milestones, and duration bars.
   - **Project-Scoped Filtering**: View schedules strictly for the selected project (*Apex Medical Tower* or *Horizon Data Center*).

2. **📑 Submittal Register & Specification Cut Sheets**
   - Track Division 23 & 25 BAS equipment packages, controller cut sheets, and DDC engineering drawings.
   - **Native PDF & Cut Sheet Viewer**: Dual-engine viewer (Native Blob URL + SVG/Vector support) with full-screen zoom, download, and external window support.
   - Project-scoped submittal filtering so you only see packages relevant to the active job.

3. **📋 Daily Construction Logs & Manpower Tracking**
   - Daily logs recording weather conditions, site delay notices, safety incidents, and headcount.
   - Manpower breakdown tracking hours worked across Lead PM, Field Techs, Electricians, and Commissioning Agents.
   - On-site field photo attachments with lightboxes.

4. **📸 Punch Lists & Commissioning (Cx) Deficiencies**
   - **Defect Photo Lightbox**: Attach high-res site photos from iPad, phone camera, or desktop dropzone.
   - **Cx Deficiency Log**: Track equipment tags (`AHU-02`, `CH-01`, `CRAH-01`), functional test script references (FPT), and CxA sign-off workflow.

5. **📐 Plan Room & Drawing Log**
   - Plan room storing architectural, mechanical (MEP), and controls schematics (`M-101`, `E-201`, `BAS-401`).
   - Revision tracking with links to RFIs and change orders.

6. **💰 AIA G702 / G703 Pay Applications & Change Orders (COR / PCO)**
   - Industry-standard calculation engine automatically computing Lines 1 through 9.
   - Approved Change Orders automatically feed and sync into **Line 2 (Net Change Orders)**.
   - Accounts receivable aging (Current, 1–30, 31–60, 60+ days overdue).

7. **✉️ Outlook Invoicing Auto-Harvesting**
   - Automated file watcher ingesting vendor invoices dropped into `uploads/inbox/` directly into the accounting register.

8. **🛡️ Automatic Timestamped Backups**
   - Every launch automatically snapshots your project database into `backups/db_backup_TIMESTAMP.json`.

---

## 🚀 How to Launch & Use BuildTrack Pro

### Option 1: Double-Click Launcher (Recommended for Windows)
Double-click **`start.cmd`** in this folder:
- Creates an instant snapshot backup in `backups/`.
- Starts the local Node.js server.
- Opens **`http://localhost:3000`** in your default web browser.

### Option 2: Zero-Install Standalone Mode (Field & Offline)
Double-click **`BuildTrack_Pro.html`**:
- Completely self-contained single-file edition.
- Can be copied to an iPad, laptop, USB drive, or shared network drive.
- Works 100% offline with zero dependencies! Data persists in your browser's local storage with JSON export/import support.

### Option 3: Outlook Invoicing Sync
Double-click **`sync_invoices.cmd`**:
- Runs the PowerShell Outlook harvester to pull incoming billing PDFs into the project register.

### Option 4: On-Demand Database Backup
Double-click **`backup_data.cmd`**:
- Creates an immediate timestamped backup of all projects, schedules, logs, and submittals.

---

## 👥 Default Team User Profiles

| Role | Name | Responsibilities |
| :--- | :--- | :--- |
| **Lead Project Manager** | Daniel Laurel | Full administrative access, AIA G702 approvals, schedule baseline edits, contract modifications |
| **Field Superintendent** | Mike Torres | Daily logs, manpower hours, punch list inspection photos, schedule status toggles |
| **Billing & Finance** | Accounting | Accounts receivable, Pay Applications, invoice reconciliation |

---

## 📁 File Structure

```
project-manager/
├── BuildTrack_Pro.html      # Standalone single-file edition (Zero install, fully offline)
├── start.cmd                # One-click desktop launcher (Auto-backup + Server + Browser)
├── sync_invoices.cmd        # Outlook automated billing extractor
├── backup_data.cmd          # On-demand timestamped database backup utility
├── server.js                # Lightweight Node.js REST API server & inbox watcher
├── package.json             # Project metadata & npm scripts
├── public/
│   └── index.html           # Full-stack frontend with Calendar, Gantt, and Document Viewer
├── data/
│   └── db.json              # Active JSON database (Projects, Schedules, Submittals, Logs)
├── backups/                 # Auto-generated database snapshots
├── uploads/                 # Binary attachments (Field photos, cut sheets, PDF submittals)
│   └── inbox/               # Auto-ingest dropzone for Outlook billing PDFs
└── scripts/
    ├── backup.js            # Node backup utility
    └── sync_outlook.ps1     # Outlook MAPI extraction script
```
