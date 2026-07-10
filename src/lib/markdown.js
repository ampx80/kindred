// A tiny, dependency-free markdown to HTML renderer for the feature engine's
// generated documents. Supports headings, bold/italic/code, and bullet + numbered
// lists - enough for warm, well-structured plans, prayers, and scripts. Escapes
// HTML first so generated content can never inject markup.
export function mdToHtml(md = '') {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const lines = String(md).split(/\r?\n/);
  let html = '';
  let list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (/^###\s+/.test(line)) { close(); html += `<h4>${inline(line.replace(/^###\s+/, ''))}</h4>`; continue; }
    if (/^##\s+/.test(line)) { close(); html += `<h3>${inline(line.replace(/^##\s+/, ''))}</h3>`; continue; }
    if (/^#\s+/.test(line)) { close(); html += `<h2>${inline(line.replace(/^#\s+/, ''))}</h2>`; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { close(); html += '<hr>'; continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = line.match(/^\s*\d+\.\s+(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; continue; }
    if (line === '') { close(); continue; }
    close(); html += `<p>${inline(line)}</p>`;
  }
  close();
  return html;
}
