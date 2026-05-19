const { createWorker } = require("tesseract.js");
const { config } = require("../config");
const { extractPdfText } = require("./pdfText");
const { renderPdfPagesToPng } = require("./pdfToImages");

function splitTextByPage(text) {
  if (!text) {
    return [];
  }

  const pages = text.split("\f").map((page) => page.trim()).filter(Boolean);
  if (pages.length > 0) {
    return pages;
  }

  return [text.trim()];
}

async function extractChunksFromPdf(buffer) {
  const textResult = await extractPdfText(buffer);
  const normalizedText = textResult.text.trim();

  if (normalizedText.length >= config.ocrTextMinChars) {
    const pages = splitTextByPage(textResult.text);
    return pages.map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText,
      bbox: { x1: 0, y1: 0, x2: 1, y2: 1 }
    }));
  }

  const { images } = await renderPdfPagesToPng(buffer, config.ocrMaxPages);
  const worker = await createWorker();
  await worker.loadLanguage(config.ocrLanguages);
  await worker.initialize(config.ocrLanguages);
  const chunks = [];

  for (const image of images) {
    const result = await worker.recognize(image.pngBuffer);
    const pageText = (result.data && result.data.text) ? result.data.text.trim() : "";

    if (pageText) {
      chunks.push({
        pageNumber: image.pageNumber,
        text: pageText,
        bbox: { x1: 0, y1: 0, x2: 1, y2: 1 }
      });
    }
  }

  await worker.terminate();

  return chunks;
}

module.exports = { extractChunksFromPdf };
