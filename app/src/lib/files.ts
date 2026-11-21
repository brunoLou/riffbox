/** Hand a file to the user: the phone's share sheet when possible, else a download. */
export async function shareOrDownload(name: string, blob: Blob, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

/** 2026-11-21 */
export const dateStamp = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
