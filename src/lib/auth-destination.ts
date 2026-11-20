/** Accept only routes inside the Genealiz workspace. Keep the tab and item in the URL. */
export function workspaceDestination(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\/app(?:[/?#]|$)/.test(value)) return;
  if (
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return character === "\\" || code <= 32 || code === 127;
    })
  )
    return;
  const base = "https://genealiz.invalid";
  const destination = new URL(value, base);
  if (
    destination.origin !== base ||
    !/^\/app(?:\/|$)/.test(destination.pathname) ||
    /%2f|%5c/i.test(destination.pathname)
  )
    return;
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
