function toTitleCase(str) {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s\(\)\[\]\/\-_.,])([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

module.exports = { toTitleCase };
