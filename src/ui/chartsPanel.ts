export function createChartsPanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Charts</h2>
    <p>Scaffold ready: route-distance and gap chart area.</p>
  `;
  container.append(panel);
}
