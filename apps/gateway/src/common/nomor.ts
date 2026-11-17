/** Menormalkan nomor HP Indonesia ke format E.164 tanpa plus (62812xxxx). Mengembalikan null bila tidak valid. */
export function normalisasiNomor(masuk: string): string | null {
  let n = (masuk ?? '').replace(/[^\d]/g, '')
  if (n.startsWith('0')) n = '62' + n.slice(1)
  else if (n.startsWith('8')) n = '62' + n
  return /^62\d{8,13}$/.test(n) ? n : null
}
