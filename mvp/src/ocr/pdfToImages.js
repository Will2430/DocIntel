const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const { createCanvas } = require("canvas");

pdfjsLib.GlobalWorkerOptions.workerSrc = require("pdfjs-dist/legacy/build/pdf.worker.js");

async function renderPdfPagesToPng(buffer, maxPages) {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pageLimit = Math.min(totalPages, maxPages);
  const images = [];

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    await page.render({ canvasContext: ctx, viewport }).promise;

    images.push({
      pageNumber,
      pngBuffer: canvas.toBuffer("image/png"),
      width: viewport.width,
      height: viewport.height
    });
  }

  return { images, totalPages };
}

module.exports = { renderPdfPagesToPng };
