import {
  PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFSignature, PDFTextField, StandardFonts
} from "pdf-lib";
import { loadPdf, SAVE_OPTIONS, type MergeResult } from "./pdf";

export type FormFieldType = "text" | "checkbox" | "dropdown" | "radio" | "list" | "signature" | "other";
export type FormFieldValue = string | boolean;
export type FormField = { name: string; type: FormFieldType; value: FormFieldValue; options?: string[]; readOnly: boolean; multiline?: boolean };

/** List the fillable fields of a PDF (empty when it has no form). */
export async function listFormFields(bytes: Uint8Array): Promise<FormField[]> {
  const form = (await loadPdf(bytes)).getForm();
  return form.getFields().map((field): FormField => {
    const base = { name: field.getName(), readOnly: field.isReadOnly() };
    if (field instanceof PDFTextField) return { ...base, type: "text", value: field.getText() ?? "", multiline: field.isMultiline() };
    if (field instanceof PDFCheckBox) return { ...base, type: "checkbox", value: field.isChecked() };
    if (field instanceof PDFDropdown) return { ...base, type: "dropdown", value: field.getSelected()[0] ?? "", options: field.getOptions() };
    if (field instanceof PDFRadioGroup) return { ...base, type: "radio", value: field.getSelected() ?? "", options: field.getOptions() };
    if (field instanceof PDFOptionList) return { ...base, type: "list", value: field.getSelected()[0] ?? "", options: field.getOptions() };
    if (field instanceof PDFSignature) return { ...base, type: "signature", value: "", readOnly: true };
    return { ...base, type: "other", value: "", readOnly: true };
  });
}

/** Write values into the form. With `flatten`, fields become plain page content and can no longer be edited. */
export async function fillForm(bytes: Uint8Array, values: Record<string, FormFieldValue>, flatten = false): Promise<MergeResult> {
  const doc = await loadPdf(bytes);
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    let field;
    try { field = form.getField(name); } catch { continue; }
    if (field.isReadOnly()) continue;
    try {
      if (field instanceof PDFTextField) field.setText(String(value) || undefined);
      else if (field instanceof PDFCheckBox) (value ? field.check() : field.uncheck());
      else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup || field instanceof PDFOptionList) {
        if (value === "") field.clear();
        else if (!field.getOptions().includes(String(value))) throw new Error(`“${value}” is not one of: ${field.getOptions().join(", ")}`);
        else field.select(String(value));
      }
    } catch (error) {
      throw new Error(`Could not fill “${name}”: ${error instanceof Error ? error.message : "invalid value"}`);
    }
  }
  form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
  if (flatten) form.flatten();
  return { bytes: await doc.save(SAVE_OPTIONS), pageCount: doc.getPageCount() };
}
