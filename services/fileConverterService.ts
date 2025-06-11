
export const convertDocxToPdf = async (file: File): Promise<Blob> => {
  if (!window.mammoth || !window.html2canvas || !window.jspdf) {
    throw new Error('Required libraries (Mammoth, html2canvas, jsPDF) not loaded.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (!event.target || !event.target.result) {
        reject(new Error('Failed to read file.'));
        return;
      }
      try {
        const arrayBuffer = event.target.result as ArrayBuffer;
        const result = await window.mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
        const html = result.value; // The generated HTML

        // Use a hidden div to render the HTML for html2canvas
        const renderer = document.getElementById('html-renderer');
        if (!renderer) {
          reject(new Error('HTML renderer element not found.'));
          return;
        }
        renderer.innerHTML = html;
        // Add some basic styling to the renderer to mimic a document page
        renderer.style.padding = '2cm'; // A4-like padding
        renderer.style.backgroundColor = 'white';
        renderer.style.color = 'black';
        renderer.style.width = '21cm'; // Approximate A4 width
        renderer.style.minHeight = '29.7cm'; // Approximate A4 height
        renderer.style.boxSizing = 'border-box';

        // Wait for images to load, if any (simple delay, could be improved)
        await new Promise(r => setTimeout(r, 500)); 


        const canvas = await window.html2canvas(renderer, {
            scale: 2, // Improve quality
            useCORS: true, // If HTML contains external images
            logging: false, 
        });
        
        renderer.innerHTML = ''; // Clean up

        const imgData = canvas.toDataURL('image/png');
        
        const { jsPDF } = window.jspdf;
        // A4 dimensions in points: 595.28 x 841.89
        // Use canvas dimensions directly to avoid cropping issues if content is larger than A4.
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'l' : 'p', // landscape or portrait
            unit: 'px', // use pixels
            format: [canvas.width, canvas.height] // set pdf size to canvas size
        });

        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        resolve(pdf.output('blob'));

      } catch (err) {
        console.error("Conversion error:", err);
        reject(new Error('Error during DOCX to PDF conversion. The DOCX file might be corrupted or in an unsupported format.'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file.'));
    reader.readAsArrayBuffer(file);
  });
};
