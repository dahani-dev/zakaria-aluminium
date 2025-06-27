/* eslint-disable prefer-const */
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { z } from "zod/v4";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// type of Measurements
type Measurements = {
  id: number;
  designation: string;
  hauteur: number;
  largeur: number;
  quantite: number;
  pu: number;
  prix: number;
};

// schema of add form
const projectSchema = z.object({
  designation: z.string().max(200).nonempty(),
  hauteur: z.number("expected number").min(1),
  largeur: z.number("expected number").min(1),
  quantite: z.number("expected number").min(1),
  pu: z.number("expected number").min(1),
});
type AddProject = z.infer<typeof projectSchema>;

// --- Second form schema and type ---
const validationSchema = z.object({
  nClient: z.string().nonempty("Nom du client requis"),
  paymentType: z.enum(["ht", "ttc"], { required_error: "Type requis" }),
});
type ValidationForm = z.infer<typeof validationSchema>;

const PHONE_NUMBER = "0681864577";

// Utility to sanitize text for pdf-lib (fix WinAnsi encoding error)
function sanitizePdfText(text: string) {
  return text.replace(/[\u202F\u00A0]/g, " ").replace(/[^\x00-\x7F]/g, ""); // Remove non-ascii (WinAnsi) chars
}

// Utility to wrap text for PDF columns
function wrapText({
  text,
  maxWidth,
  font,
  fontSize,
}: {
  text: string;
  maxWidth: number;
  font: any;
  fontSize: number;
}): string[] {
  const words = text.split(" ");
  let lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

const Home = () => {
  const [measurements, setMeasurements] = useState<Measurements[]>([]);
  const [editId, setEditId] = useState<number | null>(null);

  // To prevent useEffect from running setValue before hydration
  const hydrated = useRef(false);

  // Hydrate from localStorage (CSR only)
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("measurements")
        : null;
    if (stored) setMeasurements(JSON.parse(stored));
    hydrated.current = true;
  }, []);

  // Persist measurements to localStorage on change
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

  // --- Second form hook ---
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

  // Add or update
  const onSubmit: SubmitHandler<AddProject> = async (data) => {
    if (editId !== null) {
      // update
      setMeasurements((prev) =>
        prev.map((item) =>
          item.id === editId
            ? {
                ...item,
                designation: data.designation,
                hauteur: data.hauteur,
                largeur: data.largeur,
                quantite: data.quantite,
                pu: data.pu,
                prix: data.hauteur * data.largeur * data.pu * data.quantite,
              }
            : item
        )
      );
      setEditId(null);
      toast.success("Modifié avec succès");
    } else {
      // add
      const newElement: Measurements = {
        id: Date.now(),
        designation: data.designation,
        hauteur: data.hauteur,
        largeur: data.largeur,
        quantite: data.quantite,
        pu: data.pu,
        prix: data.hauteur * data.largeur * data.pu * data.quantite,
      };
      setMeasurements((prev) => [...prev, newElement]);
      toast.success("Ajout réussi");
    }
    reset();
  };

  // delete
  const deleteElement = (id: number) => {
    setMeasurements((prev) => prev.filter((item) => item.id !== id));
    if (editId === id) {
      reset();
      setEditId(null);
    }
    toast.error("supprimé avec succès");
  };

  // modifier
  const handleModifier = (id: number) => {
    const item = measurements.find((el) => el.id === id);
    if (item) {
      setValue("designation", item.designation);
      setValue("hauteur", item.hauteur);
      setValue("largeur", item.largeur);
      setValue("quantite", item.quantite);
      setValue("pu", item.pu);
      setEditId(id);
    }
  };

  // generate pdf and download using pdf-lib
  const generatePdf = async (data: ValidationForm) => {
    try {
      if (measurements.length === 0) {
        toast.error("Aucune ligne dans le devis !");
        return;
      }

      // Create a new PDFDocument
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 size in points

      // Fonts
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let y = 800;

      // Header
      page.drawText("Zakaria Aluminium et Verre", {
        x: 150,
        y,
        size: 24,
        font: boldFont,
        color: rgb(0.15, 0.3, 0.8),
      });

      // Phone number and current date (generation date)
      const today = new Date();
      const formattedDate = today.toLocaleDateString("fr-FR");

      y -= 30;
      page.drawText(`Num de téléphone: ${PHONE_NUMBER}`, {
        x: 100,
        y,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      page.drawText(`Date: ${formattedDate}`, {
        x: 400,
        y,
        size: 14,
        font: font,
        color: rgb(0.2, 0.2, 0.2),
      });

      y -= 40;
      // Client info
      page.drawText(`Nom du Client: ${sanitizePdfText(data.nClient)}`, {
        x: 50,
        y,
        size: 14,
        font,
        color: rgb(0, 0, 0),
      });
      page.drawText(
        `Type de paiement: ${
          data.paymentType === "ht" ? "Montant HT" : "Montant TTC"
        }`,
        {
          x: 50,
          y: y - 20,
          size: 12,
          font,
          color: rgb(0.2, 0.2, 0.2),
        }
      );

      y -= 60;
      // Table headers
      const headers = [
        "Désignation",
        "Hauteur",
        "Largeur",
        "Quantité",
        "PU",
        "Prix",
      ];
      const x = 40;
      headers.forEach((h, i) => {
        page.drawText(h, {
          x: x + i * 85,
          y,
          size: 12,
          font: boldFont,
          color: rgb(0, 0, 0.2),
        });
      });

      y -= 18;
      page.drawLine({
        start: { x: 40, y: y + 10 },
        end: { x: 520, y: y + 10 },
        thickness: 1,
        color: rgb(0.2, 0.2, 0.2),
      });

      // Table rows with wrapping
      let total = 0;
      const rowY = y;
      const designationColX = 40;
      const designationMaxWidth = 75; // adjust as needed for your table!
      const fontSize = 10;
      let idxOffset = 0;

      measurements.forEach((item, idx) => {
        // Wrap the designation
        const designationLines = wrapText({
          text: sanitizePdfText(item.designation),
          maxWidth: designationMaxWidth,
          font,
          fontSize,
        });
        const lineCount = designationLines.length;

        for (let i = 0; i < lineCount; i++) {
          page.drawText(designationLines[i], {
            x: designationColX,
            y: rowY - (idx + idxOffset) * 20 - i * fontSize,
            size: fontSize,
            font,
          });
          if (i === 0) {
            // Only on first line draw the rest of the columns
            page.drawText(item.hauteur.toString(), {
              x: 125,
              y: rowY - (idx + idxOffset) * 20,
              size: fontSize,
              font,
            });
            page.drawText(item.largeur.toString(), {
              x: 210,
              y: rowY - (idx + idxOffset) * 20,
              size: fontSize,
              font,
            });
            page.drawText(item.quantite.toString(), {
              x: 295,
              y: rowY - (idx + idxOffset) * 20,
              size: fontSize,
              font,
            });
            page.drawText(item.pu.toString(), {
              x: 380,
              y: rowY - (idx + idxOffset) * 20,
              size: fontSize,
              font,
            });
            page.drawText((item.prix / 10000).toFixed(2), {
              x: 465,
              y: rowY - (idx + idxOffset) * 20,
              size: fontSize,
              font,
            });
            if (data.paymentType === "ht") {
              total += item.prix / 10000;
            } else {
              total += item.prix / 10000;
              total += total * 0.2;
            }
          }
        }
        idxOffset += lineCount - 1;
      });

      // Total
      const totalY =
        rowY -
        (measurements.length +
          measurements.reduce(
            (sum, item) =>
              sum +
              (wrapText({
                text: sanitizePdfText(item.designation),
                maxWidth: designationMaxWidth,
                font,
                fontSize,
              }).length -
                1),
            0
          )) *
          20 -
        10;

      page.drawLine({
        start: { x: 40, y: totalY + 10 },
        end: { x: 520, y: totalY + 10 },
        thickness: 1,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText("Total", {
        x: 380,
        y: totalY - 5,
        size: 12,
        font: boldFont,
      });
      page.drawText(total.toFixed(2) + " DH", {
        x: 465,
        y: totalY - 5,
        size: 12,
        font: boldFont,
      });

      // Download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      // Download using anchor
      const a = document.createElement("a");
      a.href = url;
      a.download = `devis_${sanitizePdfText(data.nClient)}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("PDF téléchargé avec succès !");
      resetValidation();
    } catch (error) {
      toast.error("Erreur lors de la génération du PDF");
      console.error(error);
    }
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
                htmlFor="pu"
                className="block mb-2 text-sm font-medium text-white"
              >
                Mètre carré
              </label>
              <input
                type="number"
                id="pu"
                className="bg-gray-700 border rounded-lg w-full p-2.5 outline-none border-none"
                placeholder="La valeur en centimètre"
                {...register("pu", { valueAsNumber: true })}
              />
              <p className="mb-1 text-red-500 text-sm">{errors.pu?.message}</p>
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
          <thead className="text-xs uppercase bg-gray-700 text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3">
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
                  className="text-red-600 text-2xl m-10 text-center"
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
                    className="px-6 py-4 font-medium  whitespace-nowrap text-white"
                  >
                    {item.designation}
                  </th>
                  <td className="px-6 py-4">{item.hauteur} cm</td>
                  <td className="px-6 py-4">{item.largeur} cm</td>
                  <td className="px-6 py-4">{item.quantite}</td>
                  <td className="px-6 py-4">{item.prix / 10000} DH</td>
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
      </div>
      {/* --- Second form using second hook --- */}
      <div className="mt-20">
        <form onSubmit={handleSubmitValidation(generatePdf)}>
          <h2 className="text-2xl mb-10">Validation</h2>
          <div className="flex gap-3 items-center">
            <div>
              <label
                htmlFor="nClient"
                className="block mb-2 text-sm font-medium text-white"
              >
                Nom du client
              </label>
              <input
                type="text"
                id="nClient"
                className="bg-gray-700 border rounded-lg w-full p-2.5 outline-none border-none"
                placeholder="Nom du client"
                {...registerValidation("nClient")}
              />
              <p className="mb-1 text-red-500 text-sm">
                {errorsValidation.nClient?.message}
              </p>
            </div>
            <div>
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
            className="bg-green-500 px-2 py-2 rounded cursor-pointer hover:bg-green-600 mt-5 mb-5"
            type="submit"
            disabled={isSubmittingValidation}
          >
            {isSubmittingValidation ? "Loading..." : "Télécharger le Devie"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Home;
