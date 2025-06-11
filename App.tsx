
import React, { useState, useCallback, useEffect } from 'react';
import { AppMode, ProcessedFileInfo, PageNumberPosition, StandardPdfFonts, PageNumberOptions, ImageToPdfOptions } from './types';
import FileUpload from './components/FileUpload';
import MultiFileUpload from './components/MultiFileUpload';
import LoadingSpinner from './components/LoadingSpinner';
import ActionButton from './components/ActionButton';
import { convertDocxToPdf } from './services/fileConverterService';
import { convertImagesToPdf } from './services/imageConverterService';
import {
  mergePdfs,
  extractPagesFromPdf,
  splitPdf,
  SplitPdfOptions,
  rotatePdfPages,
  RotatePdfOptions,
  addPageNumbersToPdf,
  compressPdf
} from './services/pdfManipulatorService';
import { PDFDocument } from 'pdf-lib';

// Extend Window interface for globally loaded libraries (Mammoth, html2canvas, jspdf)
declare global {
  interface Window {
    mammoth: any;
    html2canvas: any;
    jspdf: any;
  }
}

const APP_TITLE = "LovPdf";

const ROUTES: Record<string, AppMode> = {
  '/': AppMode.SELECT,
  '/lovepdf': AppMode.SELECT,
  '/tools': AppMode.SELECT,
  '/edit': AppMode.SELECT,
  '/word-to-pdf': AppMode.WORD_TO_PDF,
  '/merge-pdfs': AppMode.MERGE_PDFS,
  '/extract-pages': AppMode.EXTRACT_PAGES,
  '/split-pdf': AppMode.SPLIT_PDF,
  '/rotate-pdf': AppMode.ROTATE_PDF,
  '/add-page-numbers': AppMode.ADD_PAGE_NUMBERS,
  '/compress-pdf': AppMode.COMPRESS_PDF,
  '/images-to-pdf': AppMode.IMAGES_TO_PDF,
  '/privacy-policy': AppMode.PRIVACY_POLICY, // Added
  '/about-us': AppMode.ABOUT_US, // Added
};

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>(AppMode.SELECT);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [processedFilesInfo, setProcessedFilesInfo] = useState<ProcessedFileInfo[]>([]);
  const [currentFileNameBase, setCurrentFileNameBase] = useState<string>('');

  // Merge PDFs specific state
  const [filesToMerge, setFilesToMerge] = useState<File[]>([]);

  // Images to PDF specific state
  const [imagesToConvert, setImagesToConvert] = useState<File[]>([]);
  const [imagePdfOptions, setImagePdfOptions] = useState<ImageToPdfOptions>({ pageSize: 'A4', orientation: 'portrait' });


  // Extract Pages specific state
  const [pageRangeInput, setPageRangeInput] = useState<string>('');

  // Split PDF specific state
  const [splitOption, setSplitOption] = useState<'all' | 'ranges'>('all');
  const [splitRangesInput, setSplitRangesInput] = useState<string>('');

  // Rotate PDF specific state
  const [rotatePageNumbersInput, setRotatePageNumbersInput] = useState<string>('');
  const [rotationAngle, setRotationAngle] = useState<90 | 180 | 270>(90);

  // Add Page Numbers specific state
  const [pageNumberFormat, setPageNumberFormat] = useState<string>('%p / %t');
  const [pageNumberPosition, setPageNumberPosition] = useState<PageNumberPosition>(PageNumberPosition.BottomCenter);
  const [pageNumberFont, setPageNumberFont] = useState<StandardPdfFonts>(StandardPdfFonts.Helvetica);
  const [pageNumberFontSize, setPageNumberFontSize] = useState<number>(12);
  const [pageNumberFontColor, setPageNumberFontColor] = useState<string>('#000000');

  // General state
  const [totalPagesInCurrentPdf, setTotalPagesInCurrentPdf] = useState<number | null>(null);


  const resetState = useCallback(() => {
    setCurrentFile(null);
    setError(null);
    setProcessedFilesInfo([]);
    setCurrentFileNameBase('');
    setTotalPagesInCurrentPdf(null);
    
    setFilesToMerge([]);
    setImagesToConvert([]);
    setImagePdfOptions({ pageSize: 'A4', orientation: 'portrait' });

    setPageRangeInput('');
    setSplitOption('all');
    setSplitRangesInput('');
    setRotatePageNumbersInput('');
    setRotationAngle(90);
    setPageNumberFormat('%p / %t');
    setPageNumberPosition(PageNumberPosition.BottomCenter);
    setPageNumberFont(StandardPdfFonts.Helvetica);
    setPageNumberFontSize(12);
    setPageNumberFontColor('#000000');
  }, []);
  
  const navigateToMode = useCallback((mode: AppMode, explicitHash?: string) => {
    const targetHash = explicitHash !== undefined ? explicitHash :
      Object.keys(ROUTES).find(key => ROUTES[key] === mode && !['/', '/tools', '/edit', '/lovepdf'].includes(key)) ||
      (mode === AppMode.SELECT ? '/' : '');

    if (appMode !== mode || window.location.hash !== `#${targetHash}`) {
      resetState(); // Reset state when mode changes
      setAppMode(mode); 
    }
    
    if (window.location.hash !== `#${targetHash}`) {
      window.location.hash = `#${targetHash}`;
    }
  }, [appMode, resetState]);


  useEffect(() => {
    const determineModeFromHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      const newMode = ROUTES[hash] || AppMode.SELECT;

      if (appMode !== newMode) {
        resetState(); // Reset state if mode changes due to hash change
        setAppMode(newMode);
      }
      
      if (!ROUTES[hash] && newMode === AppMode.SELECT && hash !== '' && hash !== '/') {
        if(window.location.hash !== '#/') window.location.hash = '#/';
      }
    };

    window.addEventListener('hashchange', determineModeFromHash);
    determineModeFromHash(); 

    return () => window.removeEventListener('hashchange', determineModeFromHash);
  }, [resetState]); // appMode removed from dependency array to prevent loop, resetState handles relevant logic


  const fetchTotalPages = async (file: File) => {
    if (!file) {
      setTotalPagesInCurrentPdf(null);
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      setTotalPagesInCurrentPdf(pdfDoc.getPageCount());
    } catch (e) {
      console.error("Error fetching total pages:", e);
      setTotalPagesInCurrentPdf(null);
    }
  };

  const handleFileChange = (file: File | null) => {
    setProcessedFilesInfo([]);
    setError(null);
    setTotalPagesInCurrentPdf(null);

    setCurrentFile(file);
    if (file) {
      setCurrentFileNameBase(file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
      if (file.type === "application/pdf" && 
          [AppMode.EXTRACT_PAGES, AppMode.SPLIT_PDF, AppMode.ROTATE_PDF, AppMode.ADD_PAGE_NUMBERS, AppMode.COMPRESS_PDF].includes(appMode)) {
        fetchTotalPages(file);
      }
    } else {
      setCurrentFileNameBase('');
    }
  };
  
  const handleWordToPdf = async () => {
    if (!currentFile) { setError('Please upload a .docx file first.'); return; }
    setIsProcessing(true); setError(null); setProcessedFilesInfo([]);
    try {
      const pdfBlob = await convertDocxToPdf(currentFile);
      setProcessedFilesInfo([{ name: `${currentFileNameBase}_converted.pdf`, url: URL.createObjectURL(pdfBlob) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion error.');
    } finally { setIsProcessing(false); }
  };
    
  const handleImagesToPdf = async () => {
    if (imagesToConvert.length === 0) { setError('Please upload at least one image file.'); return; }
    setIsProcessing(true); setError(null); setProcessedFilesInfo([]);
    try {
      const pdfBytes = await convertImagesToPdf(imagesToConvert, imagePdfOptions);
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      setProcessedFilesInfo([{ name: `images_converted.pdf`, url: URL.createObjectURL(pdfBlob) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image to PDF conversion error.');
    } finally { setIsProcessing(false); }
  };

  const handleMergePdfs = async () => {
    if (filesToMerge.length < 2) { setError('Upload at least two PDFs.'); return; }
    setIsProcessing(true); setError(null); setProcessedFilesInfo([]);
    try {
      const mergedPdfBytes = await mergePdfs(filesToMerge);
      const pdfBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      setProcessedFilesInfo([{ name: `merged_document.pdf`, url: URL.createObjectURL(pdfBlob) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merging error.');
    } finally { setIsProcessing(false); }
  };

  const handleExtractPages = async () => {
    if (!currentFile) { setError('Please upload a PDF.'); return; }
    if (!pageRangeInput.trim()) { setError('Enter page ranges.'); return; }
    setIsProcessing(true); setError(null); setProcessedFilesInfo([]);
    try {
      const extractedPdfBytes = await extractPagesFromPdf(currentFile, pageRangeInput);
      const pdfBlob = new Blob([extractedPdfBytes], { type: 'application/pdf' });
      setProcessedFilesInfo([{ name: `${currentFileNameBase}_extracted.pdf`, url: URL.createObjectURL(pdfBlob) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction error. Check page range format (e.g., 1-3, 5, 7).');
    } finally { setIsProcessing(false); }
  };

  const handleSplitPdf = async () => {
    if (!currentFile) { setError('Please upload a PDF.'); return; }
    if (splitOption === 'ranges' && !splitRangesInput.trim()) { setError('Enter page ranges for splitting.'); return; }
    setIsProcessing(true); setError(null); setProcessedFilesInfo([]);
    try {
      const options: SplitPdfOptions = { mode: splitOption, rangesStr: splitRangesInput };
      const splitBlobs = await splitPdf(currentFile, options);
      const newProcessedFiles: ProcessedFileInfo[] = splitBlobs.map((item, index) => ({
        name: item.filename || `${currentFileNameBase}_split_${index + 1}.pdf`,
        url: URL.createObjectURL(item.blob)
      }));
      setProcessedFilesInfo(newProcessedFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Splitting error.');
    } finally { setIsProcessing(false); }
  };

  const handleRotatePdf = async () => {
    if (!currentFile) { setError('Please upload a PDF.'); return; }
    if (!rotatePageNumbersInput.trim()) { setError('Enter page numbers to rotate.'); return; }
    setIsProcessing(true); setError(null); setProcessedFilesInfo([]);
    try {
      const options: RotatePdfOptions = { pageRangesStr: rotatePageNumbersInput, angle: rotationAngle };
      const rotatedPdfBytes = await rotatePdfPages(currentFile, options);
      const pdfBlob = new Blob([rotatedPdfBytes], { type: 'application/pdf' });
      setProcessedFilesInfo([{ name: `${currentFileNameBase}_rotated.pdf`, url: URL.createObjectURL(pdfBlob) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotation error.');
    } finally { setIsProcessing(false); }
  };

  const handleAddPageNumbers = async () => {
    if (!currentFile) { setError('Please upload a PDF.'); return; }
    setIsProcessing(true); setError(null); setProcessedFilesInfo([]);
    try {
      const options: PageNumberOptions = {
        format: pageNumberFormat,
        position: pageNumberPosition,
        font: pageNumberFont,
        fontSize: pageNumberFontSize,
        colorHex: pageNumberFontColor,
      };
      const numberedPdfBytes = await addPageNumbersToPdf(currentFile, options);
      const pdfBlob = new Blob([numberedPdfBytes], { type: 'application/pdf' });
      setProcessedFilesInfo([{ name: `${currentFileNameBase}_numbered.pdf`, url: URL.createObjectURL(pdfBlob) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding page numbers.');
    } finally { setIsProcessing(false); }
  };

  const handleCompressPdf = async () => {
    if (!currentFile) { setError('Please upload a PDF.'); return; }
    setIsProcessing(true); setError(null); setProcessedFilesInfo([]);
    try {
      const originalSize = currentFile.size;
      const compressedPdfBytes = await compressPdf(currentFile);
      const pdfBlob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
      setProcessedFilesInfo([{ 
        name: `${currentFileNameBase}_compressed.pdf`, 
        url: URL.createObjectURL(pdfBlob),
        originalSize: originalSize,
        processedSize: pdfBlob.size
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression error.');
    } finally { setIsProcessing(false); }
  };
  
  const renderSelectMode = () => {
    const tools = [
      { mode: AppMode.WORD_TO_PDF, label: "Word to PDF", icon: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM9 18H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V8h2v2zm10-3.75L14.75 2H10v5h9V6.25z" },
      { mode: AppMode.IMAGES_TO_PDF, label: "Images to PDF", icon: "M4 5h16v10H4V5zm0 12h16v2H4v-2zm8-10a3 3 0 100 6 3 3 0 000-6zM4 3a2 2 0 00-2 2v14a2 2 0 002 2h16a2 2 0 002-2V5a2 2 0 00-2-2H4zm13 8l-3-3-6 6h12l-3-3z" },
      { mode: AppMode.MERGE_PDFS, label: "Merge PDFs", icon: "M10 3v4a1 1 0 001 1h4M5 10V4a1 1 0 011-1h12a1 1 0 011 1v4M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10M5 10h14" },
      { mode: AppMode.EXTRACT_PAGES, label: "Extract PDF Pages", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
      { mode: AppMode.SPLIT_PDF, label: "Split PDF", icon: "M12 6v6m0 0v6m0-6h6m-6 0H6 M6 6l6-4 6 4 M6 18l6 4 6-4" },
      { mode: AppMode.ROTATE_PDF, label: "Rotate PDF", icon: "M15 3H9m6 0v6M9 3v6m0-6H3m6 0h6M3 9h6m0 0v6M3 9V3m6 6h6m0 0v6M9 15H3m6 0v6M9 21h6m0 0v-6m0 6h6m-6 0H9" },
      { mode: AppMode.ADD_PAGE_NUMBERS, label: "Add Page Numbers", icon: "M3 5h12M9 3v2m0 16v2m-6-9h12M3 12h2M13 12h2m-4 0h2M3 12a9 9 0 0118 0 9 9 0 01-18 0z" },
      { mode: AppMode.COMPRESS_PDF, label: "Compress PDF", icon: "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" },
    ];
    return (
      <div className="text-center space-y-8">
        <h1 className="text-5xl font-bold text-red-600">{APP_TITLE}</h1>
        <p className="text-xl text-gray-600">Your free & easy online PDF toolkit. All processing is done in your browser for privacy.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4">
          {tools.map(tool => (
            <button
              key={tool.mode}
              onClick={() => navigateToMode(tool.mode)}
              className="p-6 rounded-xl shadow-lg bg-white border-2 border-red-500 text-red-600 flex flex-col items-center justify-center space-y-3 transition-all duration-300 transform hover:scale-105 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-red-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} /></svg>
              <span className="text-lg font-semibold">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  const renderCommonFileUpload = (acceptedType: string, title: string, onAction: () => Promise<void>, actionText: string, children?: React.ReactNode) => (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold text-gray-700">{title}</h2>
      <FileUpload onFileChange={handleFileChange} accept={acceptedType} />
      {currentFile && <p className="text-sm text-gray-600">Selected: {currentFile.name} { (totalPagesInCurrentPdf && fileNeedsTotalPages(appMode)) && `(${totalPagesInCurrentPdf} pages)`}</p>}
      {children}
      <ActionButton onClick={onAction} disabled={!currentFile || isProcessing} className="w-full sm:w-auto bg-red-600 hover:bg-red-700">
        {actionText}
      </ActionButton>
    </div>
  );

  const fileNeedsTotalPages = (mode: AppMode) => {
    return [AppMode.EXTRACT_PAGES, AppMode.SPLIT_PDF, AppMode.ROTATE_PDF, AppMode.ADD_PAGE_NUMBERS, AppMode.COMPRESS_PDF].includes(mode);
  }

  const renderPrivacyPolicy = () => (
    <div className="prose max-w-none text-gray-700">
      <h2 className="text-3xl font-semibold mb-4">Privacy Policy for {APP_TITLE}</h2>
      <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>
      <p>Welcome to {APP_TITLE}! Your privacy is critically important to us.</p>
      <p>{APP_TITLE} is a client-side application. This means all file processing for features such as Word to PDF conversion, image to PDF creation, merging, splitting, rotating, adding page numbers, and compressing PDF documents happens directly within your web browser on your device. <strong>We do not upload your files to our servers. We do not store, collect, or have access to your documents or images at any point during or after the process.</strong></p>
      
      <h3>Information We Do Not Collect</h3>
      <ul>
        <li>We do not collect any personal identification information (such as names, email addresses, IP addresses directly linked to you by us).</li>
        <li>We do not collect or store the content or metadata of the files you process.</li>
      </ul>

      <h3>Client-Side Processing and Security</h3>
      <p>All operations are performed locally in your browser. This enhances your privacy and security as your data never leaves your computer to be processed by our servers. The security of your data during this process relies on the security of your own computer and web browser.</p>

      <h3>Cookies</h3>
      <p>LovePdf does not use cookies for its core functionality. We do not track your activity across other websites.</p>

      <h3>Third-Party Services (e.g., for Future Advertising or Analytics)</h3>
      <p>Currently, LovePdf does not integrate third-party advertising (like Google AdSense) or advanced analytics services that would track users. </p>
      <p>If, in the future, we choose to incorporate such services to support the website, this Privacy Policy will be updated accordingly. Any such services would be chosen carefully with privacy in mind. For example, if Google AdSense is used:
      Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to sites on the Internet. Users may opt out of personalized advertising by visiting Google's <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Ads Settings</a>. We would also provide clear information about any data collected by these services.</p>

      <h3>Changes to This Privacy Policy</h3>
      <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.</p>
      
      <h3>Contact Us</h3>
      <p>If you have any questions about this Privacy Policy, please refer to our "About Us" page for contact information if available, or assume for now that as a purely client-side tool, specific contact for privacy issues beyond this statement is not established unless explicitly provided elsewhere.</p>
      <p><em>This Privacy Policy is intended to be transparent. Since we don't collect your files or personal data, our policy is straightforward.</em></p>
    </div>
  );

  const renderAboutUs = () => (
    <div className="prose max-w-none text-gray-700">
      <h2 className="text-3xl font-semibold mb-4">About {APP_TITLE}</h2>
      <p>{APP_TITLE} was created with a simple vision: to provide free, accessible, and private online PDF tools for everyone.</p>
      <p>We believe that common document tasks shouldn't require expensive software subscriptions or compromise your privacy by forcing you to upload sensitive files to unknown servers. That's why all our powerful tools—from Word to PDF and Images to PDF conversion, to merging, splitting, rotating, numbering, and compressing PDFs—are designed to run entirely in your web browser.</p>
      <h3>Our Core Principles:</h3>
      <ul>
        <li><strong>Privacy First:</strong> Your files are yours. Client-side processing means we never see, store, or transmit your documents.</li>
        <li><strong>User-Friendly Design:</strong> We strive for a clean, intuitive, and beautiful interface that makes PDF manipulation simple and enjoyable.</li>
        <li><strong>Free Access for All:</strong> Our comprehensive suite of PDF tools is available free of charge.</li>
        <li><strong>Reliability & Quality:</strong> We aim to provide high-quality output for all your document needs.</li>
      </ul>
      <p>LovePdf is dedicated to making document management easier and more secure for individuals and businesses alike. We are passionate about technology and committed to continuously improving our platform with new features and enhancements based on user feedback.</p>
      <p>Thank you for choosing LovePdf! We hope our tools help you work smarter, not harder.</p>
      {/* <p><strong>Contact:</strong> You can reach us at [your-email@example.com] for feedback or inquiries. (TODO: Add a real contact method if desired)</p> */}
    </div>
  );

  const renderContent = () => {
    if (isProcessing) return <LoadingSpinner />;

    switch (appMode) {
      case AppMode.WORD_TO_PDF:
        return renderCommonFileUpload(".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word to PDF Converter", handleWordToPdf, "Convert to PDF");
      
      case AppMode.IMAGES_TO_PDF:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-gray-700">Images to PDF Converter</h2>
            <MultiFileUpload onFilesChange={setImagesToConvert} accept="image/jpeg, image/png, image/webp, image/bmp, image/gif" />
            <ActionButton onClick={handleImagesToPdf} disabled={imagesToConvert.length === 0 || isProcessing} className="w-full sm:w-auto bg-red-600 hover:bg-red-700">
              Convert Images to PDF
            </ActionButton>
          </div>
        );

      case AppMode.MERGE_PDFS:
        return (
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-gray-700">Merge PDFs</h2>
            <MultiFileUpload onFilesChange={setFilesToMerge} accept=".pdf,application/pdf" />
            <ActionButton onClick={handleMergePdfs} disabled={filesToMerge.length < 2 || isProcessing} className="w-full sm:w-auto bg-red-600 hover:bg-red-700">
              Merge PDFs
            </ActionButton>
          </div>
        );
      case AppMode.EXTRACT_PAGES:
        return renderCommonFileUpload(".pdf,application/pdf", "Extract PDF Pages", handleExtractPages, "Extract Pages & Download", (
          <div>
            <label htmlFor="pageRange" className="block text-sm font-medium text-gray-700">Pages/ranges to extract (e.g., 1, 3-5, 8):</label>
            <input type="text" id="pageRange" value={pageRangeInput} onChange={(e) => setPageRangeInput(e.target.value)} placeholder="e.g., 1-3, 5, 7-9" className="mt-1 block w-full input-style"/>
          </div>
        ));
      case AppMode.SPLIT_PDF:
        return renderCommonFileUpload(".pdf,application/pdf", "Split PDF", handleSplitPdf, "Split PDF & Download", (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Split Option:</label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center"><input type="radio" name="splitOpt" value="all" checked={splitOption === 'all'} onChange={() => setSplitOption('all')} className="radio-style"/><span className="ml-2 text-sm">Split all pages</span></label>
                <label className="flex items-center"><input type="radio" name="splitOpt" value="ranges" checked={splitOption === 'ranges'} onChange={() => setSplitOption('ranges')} className="radio-style"/><span className="ml-2 text-sm">Extract custom ranges</span></label>
              </div>
            </div>
            {splitOption === 'ranges' && (
              <div>
                <label htmlFor="splitRanges" className="block text-sm font-medium text-gray-700">Ranges (e.g., 1-2, 3, 4-5):</label>
                <input type="text" id="splitRanges" value={splitRangesInput} onChange={(e) => setSplitRangesInput(e.target.value)} placeholder="e.g., 1-2, 3, 4-5 creates 3 files" className="mt-1 block w-full input-style"/>
              </div>
            )}
          </div>
        ));
      case AppMode.ROTATE_PDF:
        return renderCommonFileUpload(".pdf,application/pdf", "Rotate PDF Pages", handleRotatePdf, "Rotate Pages & Download", (
          <div className="space-y-4">
            <div>
              <label htmlFor="rotatePages" className="block text-sm font-medium text-gray-700">Page numbers/ranges to rotate (e.g., 1, 3-5):</label>
              <input type="text" id="rotatePages" value={rotatePageNumbersInput} onChange={(e) => setRotatePageNumbersInput(e.target.value)} placeholder="e.g., 1, 3-5, 7" className="mt-1 block w-full input-style"/>
            </div>
            <div>
              <label htmlFor="rotationAngle" className="block text-sm font-medium text-gray-700">Rotation Angle (clockwise):</label>
              <select id="rotationAngle" value={rotationAngle} onChange={(e) => setRotationAngle(parseInt(e.target.value) as 90|180|270)} className="mt-1 block w-full select-style">
                <option value="90">90 degrees</option>
                <option value="180">180 degrees</option>
                <option value="270">270 degrees</option>
              </select>
            </div>
          </div>
        ));
      case AppMode.ADD_PAGE_NUMBERS:
        return renderCommonFileUpload(".pdf,application/pdf", "Add Page Numbers to PDF", handleAddPageNumbers, "Add Page Numbers & Download", (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="pnFormat" className="label-style">Format (%p: current, %t: total):</label><input type="text" id="pnFormat" value={pageNumberFormat} onChange={e => setPageNumberFormat(e.target.value)} className="input-style"/></div>
            <div><label htmlFor="pnPos" className="label-style">Position:</label><select id="pnPos" value={pageNumberPosition} onChange={e => setPageNumberPosition(e.target.value as PageNumberPosition)} className="select-style">{Object.values(PageNumberPosition).map(p => <option key={p} value={p}>{p.replace(/([A-Z])/g, ' $1').trim()}</option>)}</select></div>
            <div><label htmlFor="pnFont" className="label-style">Font:</label><select id="pnFont" value={pageNumberFont} onChange={e => setPageNumberFont(e.target.value as StandardPdfFonts)} className="select-style">{Object.values(StandardPdfFonts).map(f => <option key={f} value={f}>{f.replace(/([A-Z])/g, ' $1').trim()}</option>)}</select></div>
            <div><label htmlFor="pnSize" className="label-style">Font Size (pt):</label><input type="number" id="pnSize" min="1" value={pageNumberFontSize} onChange={e => setPageNumberFontSize(parseInt(e.target.value) || 12)} className="input-style"/></div>
            <div><label htmlFor="pnColor" className="label-style">Font Color (hex):</label><input type="text" id="pnColor" value={pageNumberFontColor} onChange={e => setPageNumberFontColor(e.target.value)} placeholder="#000000" className="input-style"/></div>
          </div>
        ));
      case AppMode.COMPRESS_PDF:
        return renderCommonFileUpload(".pdf,application/pdf", "Compress PDF", handleCompressPdf, "Compress PDF & Download");
      case AppMode.PRIVACY_POLICY:
        return renderPrivacyPolicy();
      case AppMode.ABOUT_US:
        return renderAboutUs();
      case AppMode.SELECT:
      default:
        return renderSelectMode();
    }
  };
  
  const commonInputStyle = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm";
  const commonLabelStyle = "block text-sm font-medium text-gray-700";
  const commonRadioStyle = "focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300";

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 py-8 px-4 flex flex-col items-center selection:bg-red-200 selection:text-red-800">
      <style>{`.input-style { ${commonInputStyle} } .label-style { ${commonLabelStyle} } .select-style { ${commonInputStyle} } .radio-style { ${commonRadioStyle} }`}</style>
      <div className="w-full max-w-3xl bg-white p-6 sm:p-8 rounded-xl shadow-2xl">
        { ![AppMode.SELECT, AppMode.PRIVACY_POLICY, AppMode.ABOUT_US].includes(appMode) && ( // Standard tool header
            <button
              onClick={() => navigateToMode(AppMode.SELECT, '/')}
              className="mb-6 text-sm text-red-600 hover:text-red-800 flex items-center transition-colors"
              aria-label="Back to tool selection"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
              Back to All Tools
            </button>
        )}
         { [AppMode.PRIVACY_POLICY, AppMode.ABOUT_US].includes(appMode) && ( // Different header for static pages
            <button
              onClick={() => navigateToMode(AppMode.SELECT, '/')}
              className="mb-6 text-sm text-red-600 hover:text-red-800 flex items-center transition-colors"
              aria-label="Back to homepage"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              Back to Homepage
            </button>
        )}
        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {processedFilesInfo.length > 0 && appMode !== AppMode.SELECT && !isProcessing && (
          <div className="my-6 p-4 bg-green-50 border border-green-300 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-green-800 mb-3">Processing Successful!</h3>
            {processedFilesInfo.map((fileInfo, index) => (
              <div key={index} className="mb-2">
                <a
                  href={fileInfo.url}
                  download={fileInfo.name}
                  className="text-red-600 hover:text-red-800 hover:underline font-medium flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  Download: {fileInfo.name}
                </a>
                {appMode === AppMode.COMPRESS_PDF && fileInfo.originalSize && fileInfo.processedSize && (
                     <p className="text-xs text-gray-600 ml-7">
                        Original: {(fileInfo.originalSize / 1024).toFixed(2)} KB, Compressed: {(fileInfo.processedSize / 1024).toFixed(2)} KB 
                        (Reduced by {((1 - fileInfo.processedSize / fileInfo.originalSize) * 100).toFixed(1)}%)
                     </p>
                )}
              </div>
            ))}
          </div>
        )}
        {renderContent()}
      </div>
       <footer className="mt-12 text-center text-sm text-gray-600 space-y-1 px-4">
        <p>
          <a href="#/privacy-policy" className="hover:underline text-red-600 hover:text-red-800">Privacy Policy</a> | 
          <a href="#/about-us" className="hover:underline text-red-600 hover:text-red-800"> About Us</a>
        </p>
        <p>&copy; {new Date().getFullYear()} {APP_TITLE}. Edit PDFs with love, client-side for your privacy.</p>
        <p>All your PDF operations in one place: Word to PDF, Images to PDF, Merge, Split, Rotate, Number, Compress, and more!</p>
      </footer>
    </div>
  );
};

export default App;