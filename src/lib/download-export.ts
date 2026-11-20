import { supabase } from "@/integrations/supabase/client";
import type { ExportPageReader, ExportRow } from "@/lib/data-export";

export const readExportPage: ExportPageReader = async ({ table, filter, from, to, columns }) => {
  const { data, error } = await supabase
    .from(table)
    .select(columns ?? "*")
    .in(filter.column, filter.values)
    .order("id")
    .range(from, to);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as unknown as ExportRow[];
};

export function downloadJson(content: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
