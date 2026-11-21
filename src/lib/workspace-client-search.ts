import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const clientSummary = z.object({
  id: z.string(),
  full_name: z.string(),
  preferred_name: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  birth_date: z.string().nullable().default(null),
  birthplace: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  presenting_complaint: z.string().nullable().default(null),
  consent_given_at: z.string().nullable().default(null),
  tags: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
});

const pageSchema = z.object({
  clients: z.array(clientSummary),
  total: z.number().int().nonnegative(),
});

export async function readWorkspaceClientPage(
  client: SupabaseClient<Database>,
  {
    search = "",
    status = "active",
    offset = 0,
    limit = 24,
    details = false,
    withoutUpcoming = false,
  }: {
    search?: string;
    status?: "active" | "archived";
    offset?: number;
    limit?: number;
    details?: boolean;
    withoutUpcoming?: boolean;
  } = {},
) {
  const { data, error } = await client.rpc("search_workspace_clients", {
    _search: search,
    _status: status,
    _offset: offset,
    _limit: limit,
    _details: details,
    _without_upcoming: withoutUpcoming,
  });
  if (error) throw error;
  const page = pageSchema.parse(data);
  return { ...page, hasMore: offset + page.clients.length < page.total };
}
