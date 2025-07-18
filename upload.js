const fileInput = document.getElementById('fileInput');
const status = document.getElementById('status');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  status.textContent = 'Procesando OCR del CV...';

  const fileReader = new FileReader();
  fileReader.onload = async function () {
    const typedArray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument(typedArray).promise;
    const totalPages = pdf.numPages;

    let fullText = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 3 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;
      binarizeCanvas(canvas);

      const imageDataURL = canvas.toDataURL('image/jpeg');

      const result = await Tesseract.recognize(
        imageDataURL,
        'spa',
        { logger: m => console.log(m) }
      );

      fullText += `\n${result.data.text}`;
    }

    guardarEnLocalStorage(file.name, fullText);

    status.textContent = '✅ CV cargado correctamente. Ya podés ver el resumen.';
  };

  fileReader.readAsArrayBuffer(file);
});

function binarizeCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const bin = avg > 180 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = bin;
  }

  ctx.putImageData(imageData, 0, 0);
}

function guardarEnLocalStorage(nombreArchivo, texto) {
  let data = JSON.parse(localStorage.getItem('cvData')) || [];
  data.push({
    id: Date.now(),
    nombre: nombreArchivo,
    texto: texto,
    resumen: null
  });
  localStorage.setItem('cvData', JSON.stringify(data));
}
