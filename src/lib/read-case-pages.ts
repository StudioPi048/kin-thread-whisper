type CasePage<Row> = { data: Row[] | null; error: unknown };

/** Advance by ID until an empty page, even when the server enforces a smaller page size. */
export async function readCasePages<Row>(
  fetchPage: (after: string | null, limit: number) => PromiseLike<CasePage<Row>>,
  getId: (row: Row) => string,
): Promise<Row[]> {
  const rows: Row[] = [];
  let after: string | null = null;
  for (;;) {
    const { data, error } = await fetchPage(after, 500);
    if (error) throw error;
    if (!data?.length) return rows;
    const next = getId(data[data.length - 1]);
    if (next === after) throw new Error("A leitura do dossiê não avançou. Tente novamente.");
    rows.push(...data);
    after = next;
  }
}
