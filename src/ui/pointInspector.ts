export function createPointInspector(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel point-panel";
  panel.innerHTML = `
    <h2>Point Inspector</h2>
    <p>Scaffold ready: raw ping and interpolated point details.</p>
  `;
  container.append(panel);
}
