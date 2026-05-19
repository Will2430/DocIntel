const pdfParse = require("pdf-parse");

async function extractPdfText(buffer) {
  const data = await pdfParse(buffer);
  return {
    text: data.text || "",
    numPages: data.numpages || 0
  };
}

module.exports = { extractPdfText };
