export enum AppMode {
  SELECT = 'SELECT',
  WORD_TO_PDF = 'WORD_TO_PDF',
  MERGE_PDFS = 'MERGE_PDFS',
  EXTRACT_PAGES = 'EXTRACT_PAGES',
  SPLIT_PDF = 'SPLIT_PDF',
  ROTATE_PDF = 'ROTATE_PDF',
  ADD_PAGE_NUMBERS = 'ADD_PAGE_NUMBERS',
  COMPRESS_PDF = 'COMPRESS_PDF',
  IMAGES_TO_PDF = 'IMAGES_TO_PDF',
  PRIVACY_POLICY = 'PRIVACY_POLICY', // Added
  ABOUT_US = 'ABOUT_US', // Added
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  // Add other chunk types if needed
}

export interface ProcessedFileInfo {
  name: string;
  url: string;
  originalSize?: number;
  processedSize?: number;
}

// For Add Page Numbers feature
export enum PageNumberPosition {
  TopLeft = 'TopLeft',
  TopCenter = 'TopCenter',
  TopRight = 'TopRight',
  BottomLeft = 'BottomLeft',
  BottomCenter = 'BottomCenter',
  BottomRight = 'BottomRight',
}

export enum StandardPdfFonts {
    Helvetica = 'Helvetica',
    HelveticaBold = 'Helvetica-Bold',
    TimesRoman = 'Times-Roman',
    TimesRomanBold = 'Times-Roman-Bold',
    Courier = 'Courier',
}

export interface PageNumberOptions {
  format: string;
  position: PageNumberPosition;
  font: StandardPdfFonts;
  fontSize: number;
  colorHex: string;
}

// Options for image to PDF conversion (can be expanded)
export interface ImageToPdfOptions {
  pageSize?: 'A4' | 'Letter' | [number, number]; // Predefined or custom [width, height] in points
  orientation?: 'portrait' | 'landscape';
  // Potentially add margins, image fitting strategy (contain, cover, stretch)
}