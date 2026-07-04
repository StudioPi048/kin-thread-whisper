import { supabase } from "@/integrations/supabase/client";

/**
 * Garante que exista uma pessoa `is_proband=true` no genograma do cliente,
 * espelhando os dados do cadastro clínico (tabela `clients`).
 *
 * Regra do produto: o CLIENTE é sempre o foco do genossociograma. Se a
 * planilha importada não trouxer a linha "Consulente", nós mesmos criamos
 * a partir do dossiê já existente (nome, data de nascimento, gênero, local).
 *
 * Idempotente: se já existir uma pessoa com is_proband=true para o cliente,
 * apenas atualiza os campos vazios com dados do cadastro. Se existir uma
 * pessoa com relationship_to_proband="Consulente" mas sem a flag, promove-a
 * a proband em vez de criar uma nova.
 */
export async function ensureProband(clientId: string): Promise<{ probandId: string } | null> {
  // 1) Buscar o cadastro do cliente
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("full_name, preferred_name, birth_date, gender, birthplace, presenting_complaint")
    .eq("id", clientId)
    .maybeSingle();
  if (clientErr || !client) return null;

  // 2) Já existe um proband? Só sincroniza campos vazios.
  const { data: existingProband } = await supabase
    .from("genogram_persons")
    .select("id, full_name, birth_date, gender, notes")
    .eq("client_id", clientId)
    .eq("is_proband", true)
    .maybeSingle();

  if (existingProband) {
    const patch: Record<string, unknown> = {};
    if (!existingProband.full_name?.trim() && client.full_name) patch.full_name = client.full_name;
    if (!existingProband.birth_date && client.birth_date) patch.birth_date = client.birth_date;
    if ((!existingProband.gender || existingProband.gender === "unknown") && client.gender) {
      patch.gender = client.gender;
    }
    if (!existingProband.notes && client.presenting_complaint) patch.notes = client.presenting_complaint;
    if (Object.keys(patch).length > 0) {
      await supabase.from("genogram_persons").update(patch).eq("id", existingProband.id);
    }
    return { probandId: existingProband.id };
  }

  // 3) Existe uma linha "Consulente" sem flag? Promover.
  const { data: consulenteRow } = await supabase
    .from("genogram_persons")
    .select("id")
    .eq("client_id", clientId)
    .ilike("relationship_to_proband", "consulente")
    .maybeSingle();

  if (consulenteRow) {
    await supabase
      .from("genogram_persons")
      .update({
        is_proband: true,
        full_name: client.full_name ?? "",
        birth_date: client.birth_date ?? null,
        gender: client.gender ?? "unknown",
        notes: client.presenting_complaint ?? null,
        relationship_to_proband: "Consulente",
      })
      .eq("id", consulenteRow.id);
    return { probandId: consulenteRow.id };
  }

  // 4) Criar do zero a partir do cadastro clínico.
  const { data: created, error: insErr } = await supabase
    .from("genogram_persons")
    .insert({
      client_id: clientId,
      full_name: client.full_name ?? "",
      preferred_name: client.preferred_name ?? null,
      birth_date: client.birth_date ?? null,
      gender: client.gender ?? "unknown",
      is_proband: true,
      relationship_to_proband: "Consulente",
      notes: client.presenting_complaint ?? null,
    })
    .select("id")
    .single();
  if (insErr || !created) return null;
  return { probandId: created.id };
}
