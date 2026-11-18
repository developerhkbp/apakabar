/** Alamat foto dari superapp per anggota (dipakai bila anggota belum punya foto sendiri di ApaKabaR). */
const peta = new Map<string, string>()
const pendengar = new Set<() => void>()

export const fotoUrlAnggota = (id: string) => peta.get(id)

/** Mendaftarkan alamat foto; avatar yang sedang tampil otomatis menyegarkan diri. */
export function daftarkanFotoUrl(daftar: { id: string; fotoUrl?: string | null }[]) {
  let berubah = false
  for (const a of daftar) {
    if (a.fotoUrl && peta.get(a.id) !== a.fotoUrl) { peta.set(a.id, a.fotoUrl); berubah = true }
  }
  if (berubah) pendengar.forEach(f => f())
}

export function langgananFotoUrl(f: () => void) {
  pendengar.add(f)
  return () => { pendengar.delete(f) }
}
