export function createRoutePanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Reference Route</h2>
    <p>Scaffold ready: choose uploaded route, rider route, or consensus route.</p>
  `;
  container.append(panel);
}
