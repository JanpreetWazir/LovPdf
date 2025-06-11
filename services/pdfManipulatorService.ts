

import { PDFDocument, StandardFonts, rgb, degrees, PDFFont, RotationTypes } from 'pdf-lib'; // Added RotationTypes for potential future use, degrees is key
import { PageNumberPosition, StandardPdfFonts, PageNumberOptions } from '../types';

// getPdfLib function is removed as we now directly import from 'pdf-lib'

export const mergePdfs = async (files: File[]): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const pdfBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  return mergedPdf.save();
};

/**
 * Parses a page range string (e.g., "1-3, 5, 7-9") into an array of page numbers.
 * Page numbers are 0-indexed for use with pdf-lib.
 * @param rangeStr The input string.
 * @param maxPage The total number of pages in the document (1-indexed).
 * @returns Array of 0-indexed page numbers.
 * @throws Error if range is invalid or out of bounds.
 */
const parsePageRanges = (rangeStr: string, maxPage: number): number[] => {
  const resultPages: Set<number> = new Set();
  if (!rangeStr.trim()) return [];

  const parts = rangeStr.split(',');
  for (const part of parts) {
    const trimmedPart = part.trim();
    if (trimmedPart.includes('-')) {
      const [startStr, endStr] = trimmedPart.split('-');
      let start = parseInt(startStr, 10);
      let end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end) || start < 1 || end < start || start > maxPage ) { // end can be > maxPage if it's a range like "1-100" for a 10 page doc
        throw new Error(`Invalid page range: "${trimmedPart}". Check format and ensure page numbers are within 1-${maxPage}.`);
      }
      end = Math.min(end, maxPage); // Cap end at maxPage
      for (let i = start; i <= end; i++) {
        resultPages.add(i - 1); // 0-indexed
      }
    } else {
      const pageNum = parseInt(trimmedPart, 10);
      if (isNaN(pageNum) || pageNum < 1 || pageNum > maxPage) {
        throw new Error(`Invalid page number: "${trimmedPart}". Page must be between 1 and ${maxPage}.`);
      }
      resultPages.add(pageNum - 1); // 0-indexed
    }
  }
  return Array.from(resultPages).sort((a, b) => a - b); // Sorted
};


export const extractPagesFromPdf = async (pdfFile: File, pageRangesStr: string): Promise<Uint8Array> => {
  const existingPdfBytes = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  
  const totalPages = pdfDoc.getPageCount();
  const pagesToExtractIndices = parsePageRanges(pageRangesStr, totalPages);

  if (pagesToExtractIndices.length === 0) {
    throw new Error("No valid pages selected for extraction. Please check your input (e.g., 1-3, 5).");
  }

  const newPdfDoc = await PDFDocument.create();
  const copiedPages = await newPdfDoc.copyPages(pdfDoc, pagesToExtractIndices);
  copiedPages.forEach(page => newPdfDoc.addPage(page));

  return newPdfDoc.save();
};

export interface SplitPdfOptions {
  mode: 'all' | 'ranges';
  rangesStr?: string; // e.g., "1-2, 3, 4-5"
}

export const splitPdf = async (pdfFile: File, options: SplitPdfOptions): Promise<{blob: Blob, filename: string}[]> => {
  const existingPdfBytes = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const originalFileNameBase = pdfFile.name.substring(0, pdfFile.name.lastIndexOf('.')) || pdfFile.name;
  const results: {blob: Blob, filename: string}[] = [];

  if (options.mode === 'all') {
    for (let i = 0; i < totalPages; i++) {
      const newPdfDoc = await PDFDocument.create();
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
      newPdfDoc.addPage(copiedPage);
      const pdfBytes = await newPdfDoc.save();
      results.push({
        blob: new Blob([pdfBytes], { type: 'application/pdf' }),
        filename: `${originalFileNameBase}_page_${i + 1}.pdf`
      });
    }
  } else if (options.mode === 'ranges' && options.rangesStr) {
    const rangeSegments = options.rangesStr.split(',').map(s => s.trim()).filter(s => s);
    if(rangeSegments.length === 0) throw new Error("No ranges provided for splitting.");

    for (const segment of rangeSegments) {
      const pagesToExtractIndices = parsePageRanges(segment, totalPages);
      if (pagesToExtractIndices.length === 0) continue; // Skip empty or invalid segments

      const newPdfDoc = await PDFDocument.create();
      const copiedPages = await newPdfDoc.copyPages(pdfDoc, pagesToExtractIndices);
      copiedPages.forEach(page => newPdfDoc.addPage(page));
      const pdfBytes = await newPdfDoc.save();
      
      const segmentName = segment.replace(/[^0-9a-zA-Z-]/g, '_'); // Sanitize segment for filename
      results.push({
        blob: new Blob([pdfBytes], { type: 'application/pdf' }),
        filename: `${originalFileNameBase}_split_${segmentName}.pdf`
      });
    }
  } else {
    throw new Error("Invalid split mode or missing ranges string.");
  }
  if(results.length === 0) throw new Error("No PDFs were generated. Check your split criteria and PDF content.");
  return results;
};

export interface RotatePdfOptions {
  pageRangesStr: string; // e.g., "1, 3-5, 7"
  angle: 90 | 180 | 270;
}

export const rotatePdfPages = async (pdfFile: File, options: RotatePdfOptions): Promise<Uint8Array> => {
  const existingPdfBytes = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  const pagesToRotateIndices = parsePageRanges(options.pageRangesStr, totalPages);
  if (pagesToRotateIndices.length === 0) {
    throw new Error("No valid pages selected for rotation.");
  }

  // Validate the angle, though TypeScript types should already enforce this.
  // The options.angle itself is used directly later with degrees().
  switch (options.angle) {
    case 90:
    case 180:
    case 270:
      // Angle is valid per type `90 | 180 | 270`.
      break;
    default:
      // This block should be unreachable if options.angle adheres to its type.
      // Adding an exhaustive check for type safety in case types are bypassed.
      const exhaustiveCheck: never = options.angle;
      console.error(`Unexpected angle value received: ${exhaustiveCheck}`);
      throw new Error(`Invalid rotation angle specified: ${options.angle}. Must be 90, 180, or 270.`);
  }

  pagesToRotateIndices.forEach(pageIndex => {
    const page = pdfDoc.getPage(pageIndex);
    const currentRotation = page.getRotation().angle; // e.g. 0, 90, 180, 270
    const newRotationAngle = (currentRotation + options.angle) % 360;
    page.setRotation(degrees(newRotationAngle));
  });

  return pdfDoc.save();
};


const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
    } : { r: 0, g: 0, b: 0 }; // Default to black if parse fails
};


export const addPageNumbersToPdf = async (pdfFile: File, options: PageNumberOptions): Promise<Uint8Array> => {
  const existingPdfBytes = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();

  let fontToEmbed: PDFFont;
  // Map StandardPdfFonts enum to pdf-lib StandardFonts
  switch(options.font) {
    case StandardPdfFonts.Helvetica: fontToEmbed = await pdfDoc.embedFont(StandardFonts.Helvetica); break;
    case StandardPdfFonts.HelveticaBold: fontToEmbed = await pdfDoc.embedFont(StandardFonts.HelveticaBold); break;
    case StandardPdfFonts.TimesRoman: fontToEmbed = await pdfDoc.embedFont(StandardFonts.TimesRoman); break;
    case StandardPdfFonts.TimesRomanBold: fontToEmbed = await pdfDoc.embedFont(StandardFonts.TimesRomanBold); break;
    case StandardPdfFonts.Courier: fontToEmbed = await pdfDoc.embedFont(StandardFonts.Courier); break;
    default: fontToEmbed = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const fontColorRgb = hexToRgb(options.colorHex);

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const pageNumStr = options.format
      .replace('%p', (i + 1).toString())
      .replace('%t', totalPages.toString());

    const textWidth = fontToEmbed.widthOfTextAtSize(pageNumStr, options.fontSize);
    const textHeight = fontToEmbed.heightAtSize(options.fontSize); // Corrected: use font's height method
    const margin = 20; // Margin from edge in points

    let x: number, y: number;

    switch (options.position) {
      case PageNumberPosition.TopLeft: x = margin; y = height - textHeight - margin; break;
      case PageNumberPosition.TopCenter: x = (width - textWidth) / 2; y = height - textHeight - margin; break;
      case PageNumberPosition.TopRight: x = width - textWidth - margin; y = height - textHeight - margin; break;
      case PageNumberPosition.BottomLeft: x = margin; y = margin; break;
      case PageNumberPosition.BottomCenter: x = (width - textWidth) / 2; y = margin; break;
      case PageNumberPosition.BottomRight: x = width - textWidth - margin; y = margin; break;
      default: x = (width - textWidth) / 2; y = margin; // Default to bottom center
    }
    
    page.drawText(pageNumStr, {
      x,
      y,
      size: options.fontSize,
      font: fontToEmbed,
      color: rgb(fontColorRgb.r, fontColorRgb.g, fontColorRgb.b),
    });
  }
  return pdfDoc.save();
};

export const compressPdf = async (pdfFile: File): Promise<Uint8Array> => {
  const existingPdfBytes = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
  // Enabling object streams can reduce file size by compressing objects.
  // Advanced compression (image re-encoding, font subsetting beyond default) is complex.
  return pdfDoc.save({ useObjectStreams: true });
};