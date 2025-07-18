const fileInput = document.getElementById('fileInput');
const canvas = document.getElementById('pdfCanvas');
const outputText = document.getElementById('outputText');
const summaryText = document.getElementById('summaryText');
const ctx = canvas.getContext('2d');

// 💡 PONÉ TU API KEY ACÁ
const OPENAI_API_KEY = "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";

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  outputText.textContent = 'Cargando PDF...';
  summaryText.textContent = 'Esperando análisis...';

  const fileReader = new FileReader();
  fileReader.onload = async function () {
    const typedArray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument(typedArray).promise;
    const totalPages = pdf.numPages;

    let fullText = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      outputText.textContent = `Procesando página ${pageNum} de ${totalPages}...`;

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
        {
          logger: m => console.log(m)
        }
      );

      fullText += `\n\n--- Página ${pageNum} ---\n${result.data.text}`;
    }

    outputText.textContent = fullText || 'No se detectó texto.';

    // 📩 Mandar a OpenAI para resumir
    const resumen = await pedirResumenConGPT(fullText);
    summaryText.textContent = resumen;
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

async function pedirResumenConGPT(textoExtraido) {
  summaryText.textContent = "Generando resumen con IA...";

  const prompt = `Quiero que analices el siguiente texto extraído de un PDF y me hagas un resumen claro, profesional y fácil de entender. El texto es el siguiente:\n\n${textoExtraido}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 800
    })
  });

  if (!response.ok) {
    return `❌ Error al consultar OpenAI: ${response.status}`;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "⚠️ No se recibió respuesta.";
}
