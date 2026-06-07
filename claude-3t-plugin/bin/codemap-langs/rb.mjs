// Ruby declaration patterns for codemap.
export default [
  ["class", /^\s*(?:class|module)\s+([A-Za-z0-9_:]+)/],
  ["def", /^\s*def\s+(?:self\.)?([A-Za-z0-9_.?!]+)/],
];
