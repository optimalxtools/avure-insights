/**
 * PDF Export Utility for Avure
 * Generates professional, well-formatted PDF reports with charts and data
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'

export interface ReportMetadata {
  title: string
  subtitle?: string
  moduleName: string
  pageName: string
  generatedBy?: string
  companyName?: string
  logoUrl?: string
  filters?: Record<string, string>
}

export interface ChartData {
  title: string
  elementId: string
  description?: string
}

export interface TableData {
  title: string
  headers: string[]
  rows: (string | number)[][]
  description?: string
}

export interface ReportSection {
  title: string
  content: string
  type: 'text' | 'insight'
}

const COLORS = {
  primary: [58, 64, 53] as [number, number, number], // Sidebar green
  secondary: [255, 254, 249] as [number, number, number], // Background cream
  accent: [234, 145, 8] as [number, number, number], // Yellow accent
  text: [33, 33, 33] as [number, number, number],
  textLight: [102, 102, 102] as [number, number, number],
  border: [200, 200, 200] as [number, number, number],
}

export class PDFExporter {
  private pdf: jsPDF
  private pageWidth: number
  private pageHeight: number
  private margin: number
  private currentY: number
  private metadata: ReportMetadata

  constructor(metadata: ReportMetadata) {
    this.pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })
    this.pageWidth = this.pdf.internal.pageSize.getWidth()
    this.pageHeight = this.pdf.internal.pageSize.getHeight()
    this.margin = 20
    this.currentY = this.margin
    this.metadata = metadata
  }

  /**
   * Add a new page if needed
   */
  private checkPageBreak(requiredSpace: number = 20) {
    if (this.currentY + requiredSpace > this.pageHeight - this.margin) {
      this.pdf.addPage()
      this.currentY = this.margin
      return true
    }
    return false
  }

  /**
   * Add report header with logo, title, and filters
   */
  async addReportHeader() {
    // Add logo if provided
    if (this.metadata.logoUrl) {
      try {
        // Load image to get original dimensions
        const img = new Image()
        img.src = this.metadata.logoUrl
        
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
        })
        
        // Calculate dimensions maintaining aspect ratio
        const maxWidth = 60
        const maxHeight = 20
        const aspectRatio = img.width / img.height
        
        let imgWidth = maxWidth
        let imgHeight = maxWidth / aspectRatio
        
        // If height exceeds max, scale down based on height
        if (imgHeight > maxHeight) {
          imgHeight = maxHeight
          imgWidth = maxHeight * aspectRatio
        }
        
        this.pdf.addImage(this.metadata.logoUrl, 'PNG', this.margin, this.currentY, imgWidth, imgHeight)
        this.currentY += imgHeight + 5
      } catch (error) {
        console.error('Error loading logo:', error)
        this.currentY += 5
      }
    }

    // Company/Client name
    if (this.metadata.companyName) {
      this.pdf.setFontSize(11)
      this.pdf.setTextColor(...COLORS.textLight)
      this.pdf.setFont('helvetica', 'normal')
      this.pdf.text(this.metadata.companyName, this.margin, this.currentY)
      this.currentY += 8
    }

    // Module and Page name
    this.pdf.setFontSize(16)
    this.pdf.setTextColor(...COLORS.primary)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text(this.metadata.moduleName, this.margin, this.currentY)
    this.currentY += 7
    
    this.pdf.setFontSize(13)
    this.pdf.setTextColor(...COLORS.text)
    this.pdf.setFont('helvetica', 'normal')
    this.pdf.text(this.metadata.pageName, this.margin, this.currentY)
    this.currentY += 10

    // Filters section in a box
    if (this.metadata.filters && Object.keys(this.metadata.filters).length > 0) {
      this.pdf.setDrawColor(...COLORS.border)
      this.pdf.setLineWidth(0.5)
      
      const filterEntries = Object.entries(this.metadata.filters)
      const boxPadding = 3
      const lineHeight = 5
      const boxHeight = filterEntries.length * lineHeight + 2 * boxPadding + 5
      
      // Draw box
      this.pdf.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, boxHeight)
      
      // "Selections" label
      this.currentY += boxPadding + 4
      this.pdf.setFontSize(9)
      this.pdf.setTextColor(...COLORS.textLight)
      this.pdf.setFont('helvetica', 'bold')
      this.pdf.text('Selections:', this.margin + boxPadding, this.currentY)
      this.currentY += lineHeight
      
      // Filter values
      this.pdf.setFont('helvetica', 'normal')
      this.pdf.setTextColor(...COLORS.text)
      this.pdf.setFontSize(8)
      
      filterEntries.forEach(([key, value]) => {
        const filterText = `${key}: ${value}`
        this.pdf.text(filterText, this.margin + boxPadding, this.currentY)
        this.currentY += lineHeight
      })
      
      this.currentY += boxPadding + 5
    }

    // Date generated
    this.pdf.setFontSize(8)
    this.pdf.setTextColor(...COLORS.textLight)
    this.pdf.setFont('helvetica', 'italic')
    const dateStr = new Date().toLocaleString('en-US', { 
      dateStyle: 'medium', 
      timeStyle: 'short' 
    })
    this.pdf.text(`Generated: ${dateStr}`, this.margin, this.currentY)
    this.currentY += 10

    // Separator line
    this.pdf.setDrawColor(...COLORS.border)
    this.pdf.setLineWidth(0.3)
    this.pdf.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY)
    this.currentY += 10
  }

  /**
   * Add cover page with logo and title
   */
  async addCoverPage() {
    // Add logo if provided
    if (this.metadata.logoUrl) {
      try {
        const imgWidth = 60
        const imgHeight = 16
        const imgX = (this.pageWidth - imgWidth) / 2
        this.pdf.addImage(this.metadata.logoUrl, 'PNG', imgX, 30, imgWidth, imgHeight)
        this.currentY = 60
      } catch (error) {
        console.error('Error loading logo:', error)
        this.currentY = 40
      }
    } else {
      this.currentY = 40
    }

    // Company name
    if (this.metadata.companyName) {
      this.pdf.setFontSize(14)
      this.pdf.setTextColor(...COLORS.textLight)
      this.pdf.text(this.metadata.companyName, this.pageWidth / 2, this.currentY, { align: 'center' })
      this.currentY += 15
    }

    // Main title
    this.pdf.setFontSize(28)
    this.pdf.setTextColor(...COLORS.primary)
    this.pdf.setFont('helvetica', 'bold')
    const titleLines = this.pdf.splitTextToSize(this.metadata.title, this.pageWidth - 2 * this.margin)
    titleLines.forEach((line: string) => {
      this.pdf.text(line, this.pageWidth / 2, this.currentY, { align: 'center' })
      this.currentY += 12
    })

    // Subtitle
    if (this.metadata.subtitle) {
      this.currentY += 5
      this.pdf.setFontSize(16)
      this.pdf.setTextColor(...COLORS.textLight)
      this.pdf.setFont('helvetica', 'normal')
      this.pdf.text(this.metadata.subtitle, this.pageWidth / 2, this.currentY, { align: 'center' })
      this.currentY += 10
    }

    // Module and page info
    this.currentY += 20
    this.pdf.setFontSize(12)
    this.pdf.setTextColor(...COLORS.text)
    this.pdf.text(`${this.metadata.moduleName} - ${this.metadata.pageName}`, this.pageWidth / 2, this.currentY, { align: 'center' })

    // Metadata box
    this.currentY += 30
    const boxHeight = 40
    this.pdf.setFillColor(...COLORS.secondary)
    this.pdf.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, boxHeight, 'F')
    
    this.currentY += 10
    this.pdf.setFontSize(10)
    this.pdf.setTextColor(...COLORS.textLight)
    this.pdf.text('Report Generated', this.margin + 5, this.currentY)
    this.pdf.setTextColor(...COLORS.text)
    this.pdf.text(new Date().toLocaleString('en-US', { 
      dateStyle: 'long', 
      timeStyle: 'short' 
    }), this.margin + 5, this.currentY + 5)

    if (this.metadata.generatedBy) {
      this.currentY += 12
      this.pdf.setTextColor(...COLORS.textLight)
      this.pdf.text('Generated By', this.margin + 5, this.currentY)
      this.pdf.setTextColor(...COLORS.text)
      this.pdf.text(this.metadata.generatedBy, this.margin + 5, this.currentY + 5)
    }

    // Filters section
    if (this.metadata.filters && Object.keys(this.metadata.filters).length > 0) {
      this.currentY += 12
      this.pdf.setTextColor(...COLORS.textLight)
      this.pdf.text('Applied Filters', this.margin + 5, this.currentY)
      this.currentY += 5
      this.pdf.setTextColor(...COLORS.text)
      Object.entries(this.metadata.filters).forEach(([key, value]) => {
        this.pdf.text(`${key}: ${value}`, this.margin + 5, this.currentY)
        this.currentY += 4
      })
    }

    // Add new page for content
    this.pdf.addPage()
    this.currentY = this.margin
  }

  /**
   * Add page header
   */
  private addHeader() {
    const headerY = 10
    this.pdf.setFontSize(9)
    this.pdf.setTextColor(...COLORS.textLight)
    this.pdf.text(this.metadata.title, this.margin, headerY)
    this.pdf.text(
      `Page ${this.pdf.getCurrentPageInfo().pageNumber}`,
      this.pageWidth - this.margin,
      headerY,
      { align: 'right' }
    )
    
    // Header line
    this.pdf.setDrawColor(...COLORS.border)
    this.pdf.line(this.margin, headerY + 2, this.pageWidth - this.margin, headerY + 2)
  }

  /**
   * Add page footer
   */
  private addFooter() {
    const footerY = this.pageHeight - 10
    this.pdf.setFontSize(8)
    this.pdf.setTextColor(...COLORS.textLight)
    this.pdf.text('Avure - Confidential', this.pageWidth / 2, footerY, { align: 'center' })
  }

  /**
   * Add section title
   */
  addSectionTitle(title: string) {
    this.checkPageBreak(15)
    this.currentY += 10
    
    this.pdf.setFillColor(...COLORS.primary)
    this.pdf.rect(this.margin, this.currentY - 5, this.pageWidth - 2 * this.margin, 8, 'F')
    
    this.pdf.setFontSize(14)
    this.pdf.setTextColor(255, 255, 255)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text(title, this.margin + 3, this.currentY)
    
    this.currentY += 12
  }

  /**
   * Add text section
   */
  addSection(section: ReportSection) {
    this.checkPageBreak(20)
    
    // Section title
    this.pdf.setFontSize(12)
    this.pdf.setTextColor(...COLORS.text)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text(section.title, this.margin, this.currentY)
    this.currentY += 8

    // Content
    this.pdf.setFontSize(10)
    this.pdf.setFont('helvetica', 'normal')
    
    if (section.type === 'insight') {
      // Add insight box
      const lines = this.pdf.splitTextToSize(section.content, this.pageWidth - 2 * this.margin - 10)
      const boxHeight = lines.length * 5 + 8
      
      this.pdf.setFillColor(240, 248, 255)
      this.pdf.setDrawColor(...COLORS.primary)
      this.pdf.roundedRect(this.margin, this.currentY - 2, this.pageWidth - 2 * this.margin, boxHeight, 2, 2, 'FD')
      
      this.pdf.setTextColor(...COLORS.text)
      lines.forEach((line: string) => {
        this.pdf.text(line, this.margin + 5, this.currentY + 3)
        this.currentY += 5
      })
      this.currentY += 8
    } else {
      const lines = this.pdf.splitTextToSize(section.content, this.pageWidth - 2 * this.margin)
      this.pdf.setTextColor(...COLORS.text)
      lines.forEach((line: string) => {
        this.pdf.text(line, this.margin, this.currentY)
        this.currentY += 5
      })
      this.currentY += 5
    }
  }

  /**
   * Capture and add chart to PDF
   */
  async addChart(chart: ChartData) {
    this.checkPageBreak(80)
    
    const element = document.getElementById(chart.elementId)
    if (!element) {
      console.warn(`Chart element not found: ${chart.elementId}`)
      return
    }

    try {
      // Capture chart as image (no title/description above it)
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = this.pageWidth - 2 * this.margin
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Check if we need a new page for the chart
      if (this.currentY + imgHeight > this.pageHeight - this.margin) {
        this.pdf.addPage()
        this.currentY = this.margin
      }

      this.pdf.addImage(imgData, 'PNG', this.margin, this.currentY, imgWidth, imgHeight)
      this.currentY += imgHeight + 10
    } catch (error) {
      console.error('Error adding chart:', error)
    }
  }

  /**
   * Add data table
   */
  addTable(table: TableData) {
    this.checkPageBreak(30)
    
    // Table title
    this.pdf.setFontSize(11)
    this.pdf.setTextColor(...COLORS.text)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.text(table.title, this.margin, this.currentY)
    this.currentY += 8

    // Description if provided
    if (table.description) {
      this.pdf.setFontSize(9)
      this.pdf.setFont('helvetica', 'italic')
      this.pdf.setTextColor(...COLORS.textLight)
      const descLines = this.pdf.splitTextToSize(table.description, this.pageWidth - 2 * this.margin)
      descLines.forEach((line: string) => {
        this.pdf.text(line, this.margin, this.currentY)
        this.currentY += 4
      })
      this.currentY += 3
    }

    // Add table using autoTable
    autoTable(this.pdf, {
      head: [table.headers],
      body: table.rows,
      startY: this.currentY,
      margin: { left: this.margin, right: this.margin },
      headStyles: {
        fillColor: COLORS.primary as [number, number, number],
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.text as [number, number, number],
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250] as [number, number, number],
      },
      theme: 'grid',
    })

    const finalY = (this.pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
    this.currentY = typeof finalY === 'number' ? finalY + 10 : this.currentY + 10
  }

  /**
   * Add key metrics section
   */
  addKeyMetrics(metrics: { label: string; value: string | number; change?: string }[]) {
    this.checkPageBreak(40)
    
    this.addSectionTitle('Key Metrics')

    const metricsPerRow = 3
    const boxWidth = (this.pageWidth - 2 * this.margin - 10) / metricsPerRow
    const boxHeight = 25

    metrics.forEach((metric, index) => {
      const row = Math.floor(index / metricsPerRow)
      const col = index % metricsPerRow
      const x = this.margin + col * (boxWidth + 5)
      const y = this.currentY + row * (boxHeight + 5)

      // Metric box
      this.pdf.setFillColor(245, 247, 250)
      this.pdf.setDrawColor(...COLORS.border)
      this.pdf.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'FD')

      // Label
      this.pdf.setFontSize(8)
      this.pdf.setTextColor(...COLORS.textLight)
      this.pdf.setFont('helvetica', 'normal')
      this.pdf.text(metric.label, x + 3, y + 5)

      // Value
      this.pdf.setFontSize(14)
      this.pdf.setTextColor(...COLORS.text)
      this.pdf.setFont('helvetica', 'bold')
      this.pdf.text(String(metric.value), x + 3, y + 13)

      // Change indicator
      if (metric.change) {
        this.pdf.setFontSize(8)
        const isPositive = metric.change.startsWith('+')
        this.pdf.setTextColor(isPositive ? 34 : 220, isPositive ? 197 : 53, isPositive ? 94 : 69)
        this.pdf.text(metric.change, x + 3, y + 20)
      }
    })

    const rows = Math.ceil(metrics.length / metricsPerRow)
    this.currentY += rows * (boxHeight + 5) + 10
  }

  /**
   * Finalize and save PDF
   */
  async save(filename?: string, addHeadersFooters: boolean = false) {
    // Optionally add headers and footers to all pages
    if (addHeadersFooters) {
      const pageCount = this.pdf.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        this.pdf.setPage(i)
        if (i > 1) { // Skip cover page
          this.addHeader()
          this.addFooter()
        }
      }
    }

    const finalFilename = filename || `${this.metadata.title.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`
    this.pdf.save(finalFilename)
  }

  /**
   * Get PDF as blob (for preview or upload)
   */
  getBlob(): Blob {
    return this.pdf.output('blob')
  }

  /**
   * Get PDF as data URL
   */
  getDataUrl(): string {
    return this.pdf.output('dataurlstring')
  }
}
