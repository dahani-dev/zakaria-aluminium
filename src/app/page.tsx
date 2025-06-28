"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod/v4";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";

type Measurements = {
  id: number;
  designation: string;
  hauteur: number;
  largeur: number;
  quantite: number;
  metreCarre: number;
  prix: number;
};

const projectSchema = z.object({
  designation: z.string().max(200).nonempty(),
  hauteur: z.number("expected number").min(1),
  largeur: z.number("expected number").min(1),
  quantite: z.number("expected number").min(1),
  metreCarre: z.number("expected number").min(1),
});
type AddProject = z.infer<typeof projectSchema>;

const validationSchema = z.object({
  nClient: z.string().nonempty("Nom du client requis"),
  paymentType: z.enum(["ht", "ttc"], "Type requis"),
});
type ValidationForm = z.infer<typeof validationSchema>;

const PHONE_NUMBER = "0681864577";

function sanitizePdfText(text: string) {
  return text.replace(/[\u202F\u00A0]/g, " ").replace(/[^\x00-\x7F]/g, "");
}

const Home = () => {
  const [measurements, setMeasurements] = useState<Measurements[]>([]);
  const [editId, setEditId] = useState<number | null>(null);

  const hydrated = useRef(false);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("measurements")
        : null;
    if (stored) setMeasurements(JSON.parse(stored));
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && hydrated.current) {
      localStorage.setItem("measurements", JSON.stringify(measurements));
    }
  }, [measurements]);

  const {
    handleSubmit,
    register,
    reset,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<AddProject>({
    resolver: zodResolver(projectSchema),
  });

  const {
    handleSubmit: handleSubmitValidation,
    register: registerValidation,
    reset: resetValidation,
    formState: {
      errors: errorsValidation,
      isSubmitting: isSubmittingValidation,
    },
  } = useForm<ValidationForm>({
    resolver: zodResolver(validationSchema),
  });

  const onSubmit: SubmitHandler<AddProject> = async (data) => {
    if (editId !== null) {
      setMeasurements((prev) =>
        prev.map((item) =>
          item.id === editId
            ? {
                ...item,
                designation: data.designation,
                hauteur: data.hauteur,
                largeur: data.largeur,
                quantite: data.quantite,
                metreCarre: data.metreCarre,
                prix:
                  data.hauteur * data.largeur * data.metreCarre * data.quantite,
              }
            : item
        )
      );
      setEditId(null);
      toast.success("Modifié avec succès");
    } else {
      const newElement: Measurements = {
        id: Date.now(),
        designation: data.designation,
        hauteur: data.hauteur,
        largeur: data.largeur,
        quantite: data.quantite,
        metreCarre: data.metreCarre,
        prix: data.hauteur * data.largeur * data.metreCarre * data.quantite,
      };
      setMeasurements((prev) => [...prev, newElement]);
      toast.success("Ajout réussi");
    }
    reset();
  };

  const deleteElement = (id: number) => {
    setMeasurements((prev) => prev.filter((item) => item.id !== id));
    if (editId === id) {
      reset();
      setEditId(null);
    }
    toast.error("supprimé avec succès");
  };

  const handleModifier = (id: number) => {
    const item = measurements.find((el) => el.id === id);
    if (item) {
      setValue("designation", item.designation);
      setValue("hauteur", item.hauteur);
      setValue("largeur", item.largeur);
      setValue("quantite", item.quantite);
      setValue("metreCarre", item.metreCarre);
      setEditId(id);
    }
  };

  const generatePdf = async (data: ValidationForm) => {
    try {
      if (measurements.length === 0) {
        toast.error("Aucune ligne dans le devis !");
        return;
      }

      const pdfDoc = await PDFDocument.create();

      // A4 page size
      const pageWidth = 595;
      const pageHeight = 842;
      let page = pdfDoc.addPage([pageWidth, pageHeight]);

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const fontSize = 10;
      const cellPadding = 5;
      const minRowHeight = 20;

      // Margins
      const marginX = 30;
      const marginRight = 30;
      const availableWidth = pageWidth - marginX - marginRight;

      // Define columns with relative ratios (sum = 1)
      const columnRatios = [0.4, 0.1, 0.1, 0.1, 0.1, 0.2];

      // Calculate actual column widths
      const columns = [
        {
          title: "Désignation",
          key: "designation",
          width: availableWidth * columnRatios[0],
        },
        {
          title: "Hauteur",
          key: "hauteur",
          width: availableWidth * columnRatios[1],
        },
        {
          title: "Largeur",
          key: "largeur",
          width: availableWidth * columnRatios[2],
        },
        {
          title: "Quantité",
          key: "quantite",
          width: availableWidth * columnRatios[3],
        },
        { title: "PU", key: "pu", width: availableWidth * columnRatios[4] },
        { title: "Prix", key: "prix", width: availableWidth * columnRatios[5] },
      ];
      const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

      // Calculate starting Y position for table below header info
      const marginTop = 50;
      const titleHeight = 30;
      const phoneHeight = 20;
      const dateHeight = 20;
      const clientHeight = 20;
      const paymentTypeHeight = 20;
      const spaceBetween = 10;

      let cursorY =
        pageHeight -
        marginTop -
        titleHeight -
        phoneHeight -
        dateHeight -
        clientHeight -
        paymentTypeHeight -
        spaceBetween * 2;

      // Wrap text helper with newline sanitization
      function wrapText(
        text: string,
        maxWidth: number,
        font: PDFFont,
        fontSize: number
      ): string[] {
        // Replace newlines with space to prevent encoding error
        text = text.replace(/\r?\n|\r/g, " ");

        const lines: string[] = [];
        const words = text.split(" ");
        let currentLine = "";

        for (const word of words) {
          const testLine = currentLine ? currentLine + " " + word : word;
          const testLineWidth = font.widthOfTextAtSize(testLine, fontSize);

          if (testLineWidth <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              lines.push(currentLine);
            }

            if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
              let partialWord = "";
              for (const char of word) {
                const testPartial = partialWord + char;
                if (font.widthOfTextAtSize(testPartial, fontSize) <= maxWidth) {
                  partialWord = testPartial;
                } else {
                  if (partialWord) lines.push(partialWord);
                  partialWord = char;
                }
              }
              if (partialWord) {
                currentLine = partialWord;
              } else {
                currentLine = "";
              }
            } else {
              currentLine = word;
            }
          }
        }

        if (currentLine) {
          lines.push(currentLine);
        }

        return lines;
      }

      // Add new page function
      function addNewPage() {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        cursorY =
          pageHeight -
          marginTop -
          titleHeight -
          phoneHeight -
          dateHeight -
          clientHeight -
          paymentTypeHeight -
          spaceBetween * 2;
        drawTableHeader();
      }

      // Draw table header function
      function drawTableHeader() {
        page.drawRectangle({
          x: marginX,
          y: cursorY - minRowHeight + 5,
          width: tableWidth,
          height: minRowHeight,
          color: rgb(0.85, 0.85, 0.85),
        });

        let x = marginX;
        for (const col of columns) {
          page.drawText(col.title, {
            x: x + cellPadding,
            y: cursorY - minRowHeight / 2,
            size: fontSize,
            font: boldFont,
            color: rgb(0, 0, 0),
          });

          page.drawLine({
            start: { x: x, y: cursorY + 5 },
            end: { x: x, y: cursorY - minRowHeight + 5 },
            thickness: 1,
            color: rgb(0.3, 0.3, 0.3),
          });

          x += col.width;
        }

        // Right border of table header
        page.drawLine({
          start: { x: marginX + tableWidth, y: cursorY + 5 },
          end: { x: marginX + tableWidth, y: cursorY - minRowHeight + 5 },
          thickness: 1,
          color: rgb(0.3, 0.3, 0.3),
        });

        cursorY -= minRowHeight;
      }

      // Draw table row function
      function drawRow(item: Measurements) {
        const rawData = [
          sanitizePdfText(item.designation),
          `${item.hauteur} cm`,
          `${item.largeur} cm`,
          `${item.quantite}`,
          `${(item.hauteur * item.largeur * item.metreCarre) / 10000}`,
          `${(item.prix / 10000).toFixed(2)} DH`,
        ];

        const wrappedCells: string[][] = columns.map((col, i) =>
          wrapText(rawData[i], col.width - 2 * cellPadding, font, fontSize)
        );

        const maxLines = Math.max(...wrappedCells.map((lines) => lines.length));
        const rowHeight = Math.max(minRowHeight, maxLines * (fontSize + 4));

        if (cursorY - rowHeight < 50) {
          addNewPage();
        }

        page.drawRectangle({
          x: marginX,
          y: cursorY - rowHeight + 5,
          width: tableWidth,
          height: rowHeight,
          color: rgb(1, 1, 1),
        });

        page.drawLine({
          start: { x: marginX, y: cursorY + 5 },
          end: { x: marginX + tableWidth, y: cursorY + 5 },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });
        page.drawLine({
          start: { x: marginX, y: cursorY - rowHeight + 5 },
          end: { x: marginX + tableWidth, y: cursorY - rowHeight + 5 },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });

        let x = marginX;
        for (let i = 0; i < columns.length; i++) {
          const lines = wrappedCells[i];
          for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            page.drawText(lines[lineIndex], {
              x: x + cellPadding,
              y: cursorY - (fontSize + 4) * (lineIndex + 1) + 5,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0),
            });
          }

          page.drawLine({
            start: { x: x, y: cursorY + 5 },
            end: { x: x, y: cursorY - rowHeight + 5 },
            thickness: 0.5,
            color: rgb(0.7, 0.7, 0.7),
          });

          x += columns[i].width;
        }

        page.drawLine({
          start: { x: marginX + tableWidth, y: cursorY + 5 },
          end: { x: marginX + tableWidth, y: cursorY - rowHeight + 5 },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });

        cursorY -= rowHeight;
      }

      // Draw header texts
      page.drawText("Zakaria Aluminium et Verre", {
        x: marginX,
        y: pageHeight - marginTop,
        size: 20,
        font: boldFont,
        color: rgb(0.15, 0.3, 0.8),
      });

      page.drawText(`Téléphone: ${PHONE_NUMBER}`, {
        x: marginX,
        y: pageHeight - marginTop - titleHeight,
        size: 12,
        font,
      });

      page.drawText(`Date: ${new Date().toLocaleDateString("fr-FR")}`, {
        x: pageWidth - 150,
        y: pageHeight - marginTop - titleHeight,
        size: 12,
        font,
      });

      page.drawText(`Client: ${sanitizePdfText(data.nClient)}`, {
        x: marginX,
        y: pageHeight - marginTop - titleHeight - phoneHeight,
        size: 14,
        font,
      });

      page.drawText(
        `Type de paiement: ${
          data.paymentType === "ht" ? "Montant HT" : "Montant TTC"
        }`,
        {
          x: marginX,
          y: pageHeight - marginTop - titleHeight - phoneHeight - dateHeight,
          size: 12,
          font,
        }
      );

      // Draw the table header
      drawTableHeader();

      let total = 0;
      for (const item of measurements) {
        drawRow(item);
        total +=
          data.paymentType === "ht"
            ? item.prix / 10000
            : (item.prix / 10000) * 1.2;
      }

      if (cursorY - 40 < 50) addNewPage();

      page.drawLine({
        start: { x: marginX, y: cursorY },
        end: { x: marginX + tableWidth, y: cursorY },
        thickness: 1.5,
        color: rgb(0.2, 0.2, 0.2),
      });

      cursorY -= 30;

      page.drawRectangle({
        x: marginX + tableWidth - 150,
        y: cursorY,
        width: 150,
        height: 25,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 1,
      });

      page.drawText("Total:", {
        x: marginX + tableWidth - 140,
        y: cursorY + 8,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      page.drawText(`${total.toFixed(2)} DH`, {
        x: marginX + tableWidth - 80,
        y: cursorY + 8,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Save and trigger download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devis_${sanitizePdfText(data.nClient)}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("PDF téléchargé avec succès !");
      resetValidation();
    } catch (err) {
      toast.error("Erreur lors de la génération du PDF");
      console.error(err);
    }
  };

  const calculateTotal = () => {
    return measurements.reduce((acc, item) => acc + item.prix / 10000, 0);
  };

  return (
    <div className="p-4 sm:p-8 md:p-10">
      <h1 className="mb-8 text-xl font-bold leading-tight tracking-tight md:text-2xl text-white">
        Calculation de Devis
      </h1>
      <form
        className="space-y-4 md:space-y-6"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:h-[400px]">
          <div className="flex flex-col gap-5 h-full">
            <div className="flex flex-col flex-1">
              <label
                htmlFor="designation"
                className="block mb-2 text-sm font-medium text-white"
              >
                Désignation
              </label>
              <textarea
                id="designation"
                placeholder="exemple: une porte de aluminuim..."
                className="bg-gray-700 border rounded-lg w-full min-h-[80px] md:h-full p-2.5 outline-none border-none resize-y"
                {...register("designation")}
              ></textarea>
              <p className="mb-1 text-red-500 text-sm">
                {errors.designation?.message}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label
                htmlFor="hauteur"
                className="block mb-2 text-sm font-medium text-white"
              >
                Hauteur
              </label>
              <input
                type="number"
                id="hauteur"
                className="bg-gray-700 border rounded-lg w-full p-2.5 outline-none border-none"
                placeholder="La valeur en centimètre"
                {...register("hauteur", { valueAsNumber: true })}
              />
              <p className="mb-1 text-red-500 text-sm">
                {errors.hauteur?.message}
              </p>
            </div>
            <div>
              <label
                htmlFor="largeur"
                className="block mb-2 text-sm font-medium text-white"
              >
                Largeur
              </label>
              <input
                type="number"
                id="largeur"
                className="bg-gray-700 border rounded-lg w-full p-2.5 outline-none border-none"
                placeholder="La valeur en centimètre"
                {...register("largeur", { valueAsNumber: true })}
              />
              <p className="mb-1 text-red-500 text-sm">
                {errors.largeur?.message}
              </p>
            </div>
            <div>
              <label
                htmlFor="quantite"
                className="block mb-2 text-sm font-medium text-white"
              >
                Quantité
              </label>
              <input
                type="number"
                id="quantite"
                className="bg-gray-700 border rounded-lg w-full p-2.5 outline-none border-none"
                placeholder="La valeur en centimètre"
                {...register("quantite", { valueAsNumber: true })}
              />
              <p className="mb-1 text-red-500 text-sm">
                {errors.quantite?.message}
              </p>
            </div>
            <div>
              <label
                htmlFor="metreCarre"
                className="block mb-2 text-sm font-medium text-white"
              >
                Mètre carré
              </label>
              <input
                type="number"
                id="metreCarre"
                className="bg-gray-700 border rounded-lg w-full p-2.5 outline-none border-none"
                placeholder="La valeur en centimètre"
                {...register("metreCarre", { valueAsNumber: true })}
              />
              <p className="mb-1 text-red-500 text-sm">
                {errors.metreCarre?.message}
              </p>
            </div>
          </div>
        </div>
        <button
          type="submit"
          className="w-full text-white bg-blue-600 cursor-pointer hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Loading..."
            : editId !== null
            ? "Modifier"
            : "Ajouter"}
        </button>
        {editId !== null && (
          <button
            type="button"
            className="w-full bg-gray-500 text-white mt-2 rounded-lg text-sm px-5 py-2.5"
            onClick={() => {
              reset();
              setEditId(null);
            }}
          >
            Annuler modification
          </button>
        )}
      </form>

      <div className="relative overflow-x-auto shadow-md sm:rounded-lg mt-20">
        <table className="w-full text-sm text-left rtl:text-right text-gray-400">
          <thead className="text-xs uppercase bg-blue-500 text-white sticky top-0">
            <tr>
              <th scope="col" className="px-6 py-3 max-w-xs">
                Désignation
              </th>
              <th scope="col" className="px-6 py-3">
                Hauteur
              </th>
              <th scope="col" className="px-6 py-3">
                Largeur
              </th>
              <th scope="col" className="px-6 py-3">
                Quantité
              </th>
              <th scope="col" className="px-6 py-3">
                Prix
              </th>
              <th scope="col" className="px-6 py-3">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {measurements.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-red-600 text-2xl m-10 text-center py-8"
                >
                  No measurements!
                </td>
              </tr>
            ) : (
              measurements.map((item) => (
                <tr
                  key={item.id}
                  className={`${"odd:bg-gray-900"} border-b border-gray-700`}
                >
                  <th
                    scope="row"
                    className="px-6 py-4 font-medium text-white break-all max-w-xs whitespace-pre-line"
                    style={{ wordBreak: "break-all", maxWidth: "250px" }}
                  >
                    {item.designation}
                  </th>
                  <td className="px-6 py-4">{item.hauteur} cm</td>
                  <td className="px-6 py-4">{item.largeur} cm</td>
                  <td className="px-6 py-4">{item.quantite}</td>
                  <td className="px-6 py-4">
                    {(item.prix / 10000).toFixed(2)} DH
                  </td>
                  <td className="px-6 py-4 flex items-center gap-4">
                    <button
                      className="font-medium bg-blue-500 text-white px-2 py-1 rounded cursor-pointer hover:bg-blue-600"
                      onClick={() => handleModifier(item.id)}
                    >
                      Modifier
                    </button>
                    <button
                      className="font-medium bg-red-500 text-white px-2 py-1 rounded cursor-pointer hover:bg-red-600"
                      onClick={() => deleteElement(item.id)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Total Display */}
        {measurements.length > 0 && (
          <div className="flex justify-end mt-4 p-4 bg-gray-800 rounded-b-lg">
            <div className="bg-gray-700 text-white rounded px-6 py-3 font-bold text-lg border-2 border-blue-500">
              Total: {calculateTotal().toFixed(2)} DH
            </div>
          </div>
        )}
      </div>

      {/* --- Second form using second hook --- */}
      <div className="mt-20">
        <form onSubmit={handleSubmitValidation(generatePdf)}>
          <h2 className="text-2xl mb-10 text-white">Validation</h2>
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <div className="flex-1">
              <label
                htmlFor="nClient"
                className="block mb-2 text-sm font-medium text-white"
              >
                Nom du client
              </label>
              <input
                type="text"
                id="nClient"
                className="bg-gray-700 border rounded-lg w-full p-2.5 outline-none border-none text-white"
                placeholder="Nom du client"
                {...registerValidation("nClient")}
              />
              <p className="mb-1 text-red-500 text-sm">
                {errorsValidation.nClient?.message}
              </p>
            </div>
            <div className="flex-1">
              <label
                htmlFor="paymentType"
                className="block mb-2 text-sm font-medium text-white"
              >
                Le type de paiement
              </label>
              <select
                id="paymentType"
                className="bg-gray-700 border rounded-lg w-full p-2.5 outline-none border-none text-white"
                {...registerValidation("paymentType")}
                defaultValue=""
              >
                <option value="" disabled>
                  Sélectionnez le type de paiement
                </option>
                <option value="ht">Montant HT</option>
                <option value="ttc">Montant TTC</option>
              </select>
              <p className="mb-1 text-red-500 text-sm">
                {errorsValidation.paymentType?.message}
              </p>
            </div>
          </div>
          <button
            className="bg-green-500 px-4 py-2 rounded cursor-pointer hover:bg-green-600 mt-5 mb-5 text-white font-medium"
            type="submit"
            disabled={isSubmittingValidation}
          >
            {isSubmittingValidation ? "Loading..." : "Télécharger le Devis"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Home;
