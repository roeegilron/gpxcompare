export function createPlaybackPanel(container: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Playback</h2>
    <p>Scaffold ready: global normalized clock and playback controls.</p>
  `;
  container.append(panel);
}
