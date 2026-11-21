const A3 = { width: 420, height: 297, margin: 12 };
const drawing = { top: 23, width: A3.width - A3.margin * 2, height: 235 };
const pixelsPerMillimetre = 194 / 25.4;

function standaloneSvg(
  svg: SVGSVGElement,
  width: number,
  height: number,
  palette: CSSStyleDeclaration,
) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  for (const element of clone.querySelectorAll("[fill], [stroke]")) {
    for (const attribute of ["fill", "stroke"]) {
      const variable = element.getAttribute(attribute)?.match(/^var\((--[\w-]+)\)$/)?.[1];
      if (variable) element.setAttribute(attribute, palette.getPropertyValue(variable).trim());
    }
  }
  return new XMLSerializer().serializeToString(clone);
}

async function drawPage(svg: string, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Não foi possível renderizar uma página."));
      image.src = url;
    });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Não foi possível preparar uma página para o PDF."));
      }, "image/png");
    });
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadGenogramPdf(
  preview: HTMLElement,
  reportPage: (page: number) => void,
) {
  const sheets = [...preview.querySelectorAll<HTMLElement>(".geno-print-sheet")];
  const palette = getComputedStyle(preview);
  if (!sheets.length) throw new Error("O genossociograma está vazio.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", format: "a3", unit: "mm", compress: true });
  pdf.setProperties({ title: "Genossociograma A3", creator: "Genealiz" });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("O navegador não conseguiu preparar as páginas do PDF.");

  try {
    for (const [index, sheet] of sheets.entries()) {
      reportPage(index + 1);
      const svg = sheet.querySelector<SVGSVGElement>("svg");
      if (!svg) throw new Error("Não foi possível localizar o desenho da página.");
      const [, , viewWidth, viewHeight] = svg.getAttribute("viewBox")!.split(" ").map(Number);
      const scale = Math.min(drawing.width / viewWidth, drawing.height / viewHeight);
      const width = viewWidth * scale;
      const height = viewHeight * scale;
      canvas.width = Math.round(width * pixelsPerMillimetre);
      canvas.height = Math.round(height * pixelsPerMillimetre);
      const png = await drawPage(
        standaloneSvg(svg, canvas.width, canvas.height, palette),
        canvas,
        context,
      );

      if (index > 0) pdf.addPage();
      pdf.addImage(
        png,
        "PNG",
        (A3.width - width) / 2,
        drawing.top + (drawing.height - height) / 2,
        width,
        height,
        undefined,
        "FAST",
      );

      pdf.setTextColor("#253430");
      pdf.setFont("helvetica", "bold").setFontSize(15);
      pdf.text(sheet.querySelector("h3")?.textContent || "Genossociograma", A3.margin, 18);
      pdf.setFont("helvetica", "normal").setFontSize(10);
      pdf.text(`Página ${index + 1} de ${sheets.length}`, A3.width - A3.margin, 18, {
        align: "right",
      });
      pdf
        .setDrawColor("#c8cdc3")
        .setLineWidth(0.25)
        .line(A3.margin, 263, A3.width - A3.margin, 263);
      const legend = sheet.querySelector(".geno-print-legend")?.textContent?.trim() || "";
      pdf.text(pdf.splitTextToSize(legend, drawing.width), A3.margin, 268);
    }
    pdf.save("genossociograma-a3.pdf");
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
