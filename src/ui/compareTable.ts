export function createCompareTable(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Comparison Table</h2>
    <p>Scaffold ready: time gap / distance gap table.</p>
  `;
  container.append(panel);
}
