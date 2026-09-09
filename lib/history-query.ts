export const PAGE_SIZE = 10;
export function parseHistoryQuery(params: URLSearchParams) {
  const query = (params.get("q") ?? "").trim();
  if (query.length > 200) throw new Error("Search must be 200 characters or fewer.");
  const raw = params.get("page") ?? "1";
  const number = /^\d+$/.test(raw) ? Number(raw) : 1;
  const page = Number.isSafeInteger(number) && number > 0 ? number : 1;
  // Tournament History contains completed shoots; active shoots retain their own surface.
  const conditions = ["status = ?"];
  const bindings: (string | number)[] = ["complete"];
  for (const token of query.split(/\s+/).filter(Boolean)) {
    if (/^\d{4}$/.test(token)) {
      conditions.push("substr(date, 1, 4) = ?");
      bindings.push(token);
    } else {
      conditions.push("name LIKE ? ESCAPE '\\' COLLATE NOCASE");
      bindings.push(`%${token.replace(/[\\%_]/g, "\\$&")}%`);
    }
  }
  return { query, page, where: conditions.join(" AND "), bindings };
}

export function historyPage(requested: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pages);
  return { page, pages, offset: (page - 1) * PAGE_SIZE };
}
