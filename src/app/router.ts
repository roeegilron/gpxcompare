export function mountAppShell(root: HTMLElement): HTMLElement {
  const shell = document.createElement("main");
  shell.className = "app-shell";
  root.append(shell);
  return shell;
}
