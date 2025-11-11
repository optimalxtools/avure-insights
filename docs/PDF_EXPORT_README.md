# PDF Export - Documentation

## ✅ Current Implementation

### **Active on: Packhouse > Performance Page**

The PDF export feature is fully functional on the Packhouse Performance page only.

---

## 📄 What Gets Exported

When you click **"Export Report"** on Packhouse > Performance:

### Header Section:
- ✅ **Avure Logo** (with correct aspect ratio)
- ✅ **Client Name** (from your account)
- ✅ **Module:** "Packhouse"
- ✅ **Page:** "Performance"

### Selections Box:
All applied filters are displayed:
- Variety selection
- Block selection
- PUC selection
- Season selection
- Frequency (Daily/Weekly/Monthly)
- Date Range (if selected)

### Footer:
- Generation timestamp (e.g., "Generated: Oct 17, 2025, 1:45 PM")

### Charts:
All 4 chart sections from the Metrics tab:
1. Packing Analytics & Progress
2. Packing Class Distribution
3. Packing Spread Analysis
4. Packing Distributor Data

---

## 🎯 How to Use

1. Navigate to **Packhouse > Temporal**
2. Apply your desired filters
3. Ensure you're on the **Metrics** tab
4. Click **"Export Report"** button
5. PDF downloads as: `Packhouse_Temporal_Report_YYYY-MM-DD.pdf`

---

## � Technical Implementation

### Core Files:
- **`lib/pdf-export.ts`** - PDF generation utility
- **`lib/hooks/usePDFExport.ts`** - React hook
- **`app/(modules)/packhouse/performance/page.tsx`** - Page with export functionality

### Dependencies:
```json
{
  "jspdf": "^2.5.1",
  "jspdf-autotable": "^3.8.2",
  "html2canvas": "^1.4.1"
}
```

### Key Features:
- **html2canvas** captures DOM elements as images (2x scale for quality)
- **jsPDF** creates PDF documents
- Logo maintains original aspect ratio
- Loading states with spinner
- Graceful error handling

---

## � Adding to Other Pages (Future)

To add PDF export to other pages, follow this pattern:

### 1. Import & Hook
```tsx
import { usePDFExport } from "@/lib/hooks/usePDFExport"
import { useClientDatasetPaths } from "@/lib/hooks/useClientDatasetPaths"

export default function Page() {
  const { exportReport, isExporting } = usePDFExport()
  const { logoPath } = useClientDatasetPaths()
  
  const getClientName = () => {
    // Get from sessionStorage...
  }
}
```

### 2. Export Button
```tsx
<Button 
  onClick={async () => {
    await exportReport({
      metadata: {
        title: "Module_PageName",
        moduleName: "Module",
        pageName: "PageName",
        companyName: getClientName(),
        logoUrl: logoPath || "/logo_vera.png",
        filters: {
          // Your filters here
        }
      },
      charts: [
        { elementId: "chart-id", title: "" },
      ],
    })
  }}
  disabled={isExporting}
>
  {isExporting ? "Exporting..." : "Export Report"}
</Button>
```

### 3. Add Chart IDs
```tsx
<div id="your-chart-id" className="...">
  {/* Charts */}
</div>
```

---

## 📊 Current Status

- **Active Pages:** 1 of 15 (Packhouse > Performance only)
- **Other Pages:** Placeholder buttons (not functional)
- **Last Updated:** Oct 17, 2025

---

**For questions or issues, check the implementation in `/app/(modules)/packhouse/performance/page.tsx`**
