// The shareable "this is you" portrait. Draws the profile reveal to a canvas as
// a warm card people actually want to post - which is the growth loop native to
// a companion (every share is an invitation). Dependency-free: hand-drawn on a
// 2D canvas, exported as PNG, shared via the Web Share API with a download
// fallback. No private detail beyond what the person chooses to share.
import { domainMeta } from './store.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(/\s+/);
  let line = ''; let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); y += lh; line = words[i]; lines++;
      if (maxLines && lines >= maxLines - 1) {
        let last = line;
        while (ctx.measureText(last + '...').width > maxW && last.length) last = last.slice(0, -1);
        ctx.fillText((words.slice(i).join(' ').length > last.length ? last + '...' : line), x, y);
        return y + lh;
      }
    } else { line = test; }
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}

export function drawPortrait(profile) {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#fbeee0'); bg.addColorStop(1, '#f2ddc6');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // warm orb
  const orb = ctx.createRadialGradient(W / 2 - 40, 300, 20, W / 2, 320, 260);
  orb.addColorStop(0, '#f7bd8b'); orb.addColorStop(0.55, '#e07a4e'); orb.addColorStop(1, '#c2543a');
  ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(W / 2, 320, 150, 0, Math.PI * 2); ctx.fill();

  ctx.textAlign = 'center'; ctx.fillStyle = '#8a6d55';
  ctx.font = '600 34px Georgia, serif';
  ctx.fillText('KINDRED', W / 2, 560);

  ctx.fillStyle = '#3d2c20';
  ctx.font = '700 82px Georgia, serif';
  ctx.fillText(`This is ${profile?.name || 'you'}`, W / 2, 660);

  // top domains as chips
  const domains = (profile?.domains || []).slice(0, 3);
  ctx.font = '600 38px -apple-system, Segoe UI, sans-serif';
  const gap = 26;
  const widths = domains.map(d => ctx.measureText(`${domainMeta(d.id).emoji}  ${d.name}`).width + 64);
  let totalW = widths.reduce((a, b) => a + b, 0) + gap * (domains.length - 1);
  let cx = (W - totalW) / 2;
  let cy = 740;
  domains.forEach((d, i) => {
    const w = widths[i];
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    roundRect(ctx, cx, cy, w, 74, 37); ctx.fill();
    ctx.fillStyle = '#5a4636'; ctx.textAlign = 'left';
    ctx.fillText(`${domainMeta(d.id).emoji}  ${d.name}`, cx + 32, cy + 50);
    cx += w + gap;
  });

  // belief line
  ctx.textAlign = 'center'; ctx.fillStyle = '#4a382a';
  ctx.font = 'italic 44px Georgia, serif';
  wrap(ctx, `"${profile?.belief || 'You are already moving.'}"`, W / 2, 940, W - 200, 62, 4);

  ctx.fillStyle = '#8a6d55'; ctx.font = '500 30px -apple-system, Segoe UI, sans-serif';
  ctx.fillText('made with Kindred - your life, with company', W / 2, H - 70);

  return canvas;
}

export async function sharePortrait(profile) {
  const canvas = drawPortrait(profile);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  if (!blob) return { ok: false };
  const file = new File([blob], 'kindred-portrait.png', { type: 'image/png' });
  const text = `This is me, mapped by Kindred.`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return { ok: true, shared: true }; } catch { /* fall through */ }
  }
  // Fallback: download the image.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'kindred-portrait.png'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { ok: true, downloaded: true };
}
