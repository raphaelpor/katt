const ANSI_CYAN = "\u001B[36m";
const ANSI_BOLD = "\u001B[1m";
const ANSI_BOLD_CYAN = "\u001B[1;36m";
const ANSI_BOLD_YELLOW = "\u001B[1;33m";
const ANSI_YELLOW = "\u001B[33m";
const ANSI_ORANGE = "\u001B[38;5;208m";
const ANSI_BOLD_ORANGE = "\u001B[1;38;5;208m";
const ANSI_RESET = "\u001B[0m";

export function cyan(text: string): string {
  return `${ANSI_CYAN}${text}${ANSI_RESET}`;
}

export function bold(text: string): string {
  return `${ANSI_BOLD}${text}${ANSI_RESET}`;
}

export function cyanBold(text: string): string {
  return `${ANSI_BOLD_CYAN}${text}${ANSI_RESET}`;
}

export function yellowBold(text: string): string {
  return `${ANSI_BOLD_YELLOW}${text}${ANSI_RESET}`;
}

export function yellow(text: string): string {
  return `${ANSI_YELLOW}${text}${ANSI_RESET}`;
}

export function orange(text: string): string {
  return `${ANSI_ORANGE}${text}${ANSI_RESET}`;
}

export function orangeBold(text: string): string {
  return `${ANSI_BOLD_ORANGE}${text}${ANSI_RESET}`;
}
