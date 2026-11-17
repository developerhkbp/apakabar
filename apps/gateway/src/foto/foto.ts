import { BadRequestException } from '@nestjs/common'

export const MAKS_FOTO = 64 * 1024

/** Foto profil/grup: base64 JPEG yang sudah diperkecil di perangkat. null/kosong = hapus foto. */
export function fotoDariBase64(data?: string | null): Uint8Array<ArrayBuffer> | null {
  if (!data) return null
  const b = Buffer.from(data.replace(/^data:image\/jpeg;base64,/, ''), 'base64')
  if (b.length < 100 || b.length > MAKS_FOTO) throw new BadRequestException('Foto terlalu besar atau tidak valid')
  if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) throw new BadRequestException('Foto harus berformat JPEG')
  return new Uint8Array(b)
}
