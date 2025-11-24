export function slugify(value?: string | null): string | null {
  if (!value) return null
  let cleaned = value.trim()
  if (typeof cleaned.normalize === "function") {
    cleaned = cleaned.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  }
  const slug = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug.length > 0 ? slug : null
}

export function computeClientSlug(name?: string | null, id?: string | null) {
  const slugFromName = slugify(name)
  if (slugFromName) {
    return slugFromName
  }
  return slugify(id)
}
