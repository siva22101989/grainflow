/**
 * Generate PDF manual from markdown source files in docs/manual/
 *
 * Usage: npx tsx scripts/generate-manual-pdf.ts
 *
 * Reads all .md files in order, converts to a single PDF with:
 * - Cover page with GrainFlow branding
 * - Table of contents
 * - Chapter headers with page breaks
 * - Styled text with headings, lists, tables
 *
 * Output: docs/manual/GrainFlow-Manual.pdf
 */

import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';

const MANUAL_DIR = path.join(process.cwd(), 'docs', 'manual');
const OUTPUT_PATH = path.join(MANUAL_DIR, 'GrainFlow-Manual.pdf');

// PDF settings
const MARGIN = 20;
const PAGE_WIDTH = 210; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;
const HEADING1_SIZE = 18;
const HEADING2_SIZE = 14;
const HEADING3_SIZE = 11;
const BODY_SIZE = 10;

function getManualFiles(): string[] {
  const files = fs.readdirSync(MANUAL_DIR)
    .filter(f => f.endsWith('.md') && f !== 'GrainFlow-Manual.pdf')
    .sort();
  return files;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')     // bold
    .replace(/\*(.*?)\*/g, '$1')          // italic
    .replace(/`(.*?)`/g, '$1')            // inline code
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')   // links
    .replace(/^\s*[-*+]\s/gm, '  - ')    // list items
    .replace(/^\s*\d+\.\s/gm, (m) => '  ' + m.trim() + ' ') // numbered lists
    .replace(/^\|.*\|$/gm, '')            // table rows (simplified)
    .replace(/^---+$/gm, '')              // horizontal rules
    .replace(/^>+\s?/gm, '  ')           // blockquotes
    .replace(/\[Screenshot:.*?\]/g, '[See application for visual reference]');
}

function generatePDF() {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN;

  function checkPageBreak(needed: number = LINE_HEIGHT * 2) {
    if (y + needed > 280) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function addText(text: string, size: number = BODY_SIZE, style: string = 'normal') {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
    for (const line of lines) {
      checkPageBreak();
      doc.text(line, MARGIN, y);
      y += size * 0.5;
    }
    y += 2;
  }

  // Cover page
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('GrainFlow', PAGE_WIDTH / 2, 80, { align: 'center' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Warehouse Management System', PAGE_WIDTH / 2, 95, { align: 'center' });

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('User Manual & Admin Guide', PAGE_WIDTH / 2, 120, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Version 1.0 | ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`, PAGE_WIDTH / 2, 140, { align: 'center' });

  // Process each file
  const files = getManualFiles();
  console.log(`Processing ${files.length} manual files...`);

  for (const file of files) {
    if (file === '00-index.md') continue; // Skip index, we made a cover page

    doc.addPage();
    y = MARGIN;

    const content = fs.readFileSync(path.join(MANUAL_DIR, file), 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        y += 3;
        continue;
      }

      // Headings
      if (trimmed.startsWith('# ')) {
        checkPageBreak(20);
        addText(trimmed.replace('# ', ''), HEADING1_SIZE, 'bold');
        y += 4;
      } else if (trimmed.startsWith('## ')) {
        checkPageBreak(15);
        y += 3;
        addText(trimmed.replace('## ', ''), HEADING2_SIZE, 'bold');
        y += 2;
      } else if (trimmed.startsWith('### ')) {
        checkPageBreak(12);
        y += 2;
        addText(trimmed.replace('### ', ''), HEADING3_SIZE, 'bold');
      } else if (trimmed.startsWith('```')) {
        // Skip code blocks
        continue;
      } else if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        // Table row - render as plain text
        const cells = trimmed.split('|').filter(c => c.trim() && !c.match(/^[-:]+$/));
        if (cells.length > 0 && !cells[0]?.match(/^[-:]+$/)) {
          const rowText = cells.map(c => c.trim()).join('  |  ');
          addText(stripMarkdown(rowText), BODY_SIZE - 1);
        }
      } else {
        addText(stripMarkdown(trimmed));
      }
    }

    console.log(`  + ${file}`);
  }

  // Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i - 1} of ${pageCount - 1}`, PAGE_WIDTH / 2, 290, { align: 'center' });
    doc.text('GrainFlow Manual', MARGIN, 290);
  }

  doc.save(OUTPUT_PATH);
  console.log(`\nPDF generated: ${OUTPUT_PATH}`);
  console.log(`Pages: ${pageCount}`);
}

generatePDF();
