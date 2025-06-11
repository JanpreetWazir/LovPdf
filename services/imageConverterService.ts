

import { PDFDocument, PageSizes, PDFImage } from 'pdf-lib'; 
import { ImageToPdfOptions } from '../types';

export const convertImagesToPdf = async (
  imageFiles: File[],
  options?: ImageToPdfOptions // Currently basic options, defaults to A4 portrait
): Promise<Uint8Array> => {
  if (imageFiles.length === 0) {
    throw new Error('No image files provided.');
  }

  const pdfDoc = await PDFDocument.create();

  for (const imageFile of imageFiles) {
    const imageBytes = await imageFile.arrayBuffer();
    let pdfImage: PDFImage; 

    // Try to embed based on common types
    const fileType = imageFile.type.toLowerCase();
    if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
      pdfImage = await pdfDoc.embedJpg(imageBytes);
    } else if (fileType === 'image/png') {
      pdfImage = await pdfDoc.embedPng(imageBytes);
    } else if (fileType === 'image/webp') { // Added WebP basic support (pdf-lib might need specific handling or it might work via embedPng/Jpg if browser decodes it first)
        // For WebP, pdf-lib doesn't have a direct embedWebP.
        // A common approach is to convert WebP to PNG/JPG on client-side first
        // using a canvas, then embed. For simplicity here, we'll try to embed as PNG
        // as a fallback, which might work if the ArrayBuffer is already a decodable format.
        // This part might need a more robust WebP to PNG/JPG conversion step for wider compatibility.
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = document.createElement('img');
            
            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    ctx?.drawImage(img, 0, 0);
                    canvas.toBlob(async (blob) => {
                        if (blob) {
                            const pngBytes = await blob.arrayBuffer();
                            pdfImage = await pdfDoc.embedPng(pngBytes);
                            resolve();
                        } else {
                            reject(new Error('Canvas toBlob failed for WebP.'));
                        }
                    }, 'image/png');
                };
                img.onerror = () => reject(new Error(`Failed to load WebP image: ${imageFile.name}`));
                img.src = URL.createObjectURL(new Blob([imageBytes], {type: imageFile.type}));
            });
             URL.revokeObjectURL(img.src); // Clean up object URL
        } catch (e) {
            console.warn(`Could not convert WebP ${imageFile.name} to PNG for PDF embedding. Skipping. Error: ${e instanceof Error ? e.message : e}`);
            continue;
        }

    } else {
      console.warn(`Unsupported image type: ${imageFile.type} for file ${imageFile.name}. Skipping.`);
      continue;
    }
    
    if (!pdfImage!) { // Ensure pdfImage was successfully created, especially for WebP. Added non-null assertion as it should be assigned in try/catch or previous blocks.
        console.warn(`Failed to create PDF image for ${imageFile.name}. Skipping.`);
        continue;
    }


    const imageDims = pdfImage.scale(1); // Get natural dimensions

    let pageWidth = PageSizes.A4[0];
    let pageHeight = PageSizes.A4[1];

    if (options?.pageSize) {
        if (options.pageSize === 'A4') {
            [pageWidth, pageHeight] = PageSizes.A4;
        } else if (options.pageSize === 'Letter') {
            [pageWidth, pageHeight] = PageSizes.Letter;
        } else if (Array.isArray(options.pageSize)) {
            [pageWidth, pageHeight] = options.pageSize;
        }
    }
    
    if (options?.orientation === 'landscape' && pageWidth < pageHeight) { // Ensure correct landscape orientation
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
    } else if (options?.orientation === 'portrait' && pageWidth > pageHeight) {
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
    }


    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Scale image to fit page while maintaining aspect ratio (contain)
    // Add small margin for aesthetics
    const margin = 20; // 20 points margin on each side
    const availableWidth = pageWidth - 2 * margin;
    const availableHeight = pageHeight - 2 * margin;

    const pageAspectRatio = availableWidth / availableHeight;
    const imageAspectRatio = imageDims.width / imageDims.height;

    let drawWidth, drawHeight;
    if (imageAspectRatio > pageAspectRatio) { // Image is wider relative to page
      drawWidth = availableWidth;
      drawHeight = drawWidth / imageAspectRatio;
    } else { // Image is taller or same aspect ratio relative to page
      drawHeight = availableHeight;
      drawWidth = drawHeight * imageAspectRatio;
    }
    
    // Center the image on the page considering margins
    const x = margin + (availableWidth - drawWidth) / 2;
    const y = margin + (availableHeight - drawHeight) / 2;

    page.drawImage(pdfImage, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
    });
  }

  if (pdfDoc.getPageCount() === 0) {
    throw new Error("No images could be converted. Check image formats (JPEG, PNG, WebP supported with conversion).");
  }

  return pdfDoc.save();
};