// C# declaration patterns for codemap.
export default [
  ["type", /^\s*(?:\[[^\]]*\]\s*)*(?:public|private|internal|protected|abstract|sealed|static|partial|\s)*(?:class|interface|struct|enum|record)\s+([A-Za-z0-9_<>]+)/],
  // Method: a signature line NOT beginning with a control-flow / keyword token.
  ["method", /^(?!\s*(?:if|else|for|foreach|while|switch|case|catch|using|lock|return|do|fixed|unsafe|yield|await|throw|new|get|set)\b)\s*(?:public|private|internal|protected|static|virtual|override|async|sealed|\s)+[A-Za-z0-9_<>\[\],.?]+\s+([A-Za-z0-9_]+)\s*\([^;]*$/],
];
