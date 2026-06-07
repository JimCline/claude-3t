// Java declaration patterns for codemap.
export default [
  ["type", /^\s*(?:@\w+\s*)*(?:public|private|protected|abstract|final|static|\s)*(?:class|interface|enum|record)\s+([A-Za-z0-9_<>]+)/],
  // Method: a signature line NOT beginning with a control-flow / keyword token.
  ["method", /^(?!\s*(?:if|else|for|while|switch|case|catch|return|do|try|finally|throw|new|synchronized|assert)\b)\s*(?:public|private|protected|static|final|synchronized|abstract|native|\s)+[A-Za-z0-9_<>\[\],.?]+\s+([A-Za-z0-9_]+)\s*\([^;]*$/],
];
