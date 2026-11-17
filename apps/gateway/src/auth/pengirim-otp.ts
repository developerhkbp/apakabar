import { Injectable, Logger } from '@nestjs/common'

/** Pengirim kode OTP. Implementasi dipilih lewat env OTP_PENGIRIM (dev | whatsapp). */
export interface PengirimOtp {
  /** true bila kode boleh ikut dikembalikan di respons (hanya mode dev). */
  readonly gema: boolean
  kirim(nomorHp: string, kode: string): Promise<void>
}

@Injectable()
export class PengirimOtpDev implements PengirimOtp {
  private readonly log = new Logger('OtpDev')
  readonly gema = process.env.NODE_ENV !== 'production'
  async kirim(nomorHp: string, kode: string) {
    this.log.warn(`[DEV] OTP untuk ${nomorHp.slice(0, 5)}*****: ${kode}`)
  }
}

/**
 * WhatsApp Cloud API — template kategori AUTHENTICATION dengan tombol salin kode.
 * Memakai akun/nomor WhatsApp Business yang sama dengan superapp HKBP: nama env superapp
 * (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID) diterima, begitu juga WA_TOKEN / WA_PHONE_ID.
 */
@Injectable()
export class PengirimOtpWhatsapp implements PengirimOtp {
  private readonly log = new Logger('OtpWhatsapp')
  readonly gema = false
  async kirim(nomorHp: string, kode: string) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN ?? process.env.WA_TOKEN
    const idNomor = process.env.WHATSAPP_PHONE_NUMBER_ID ?? process.env.WA_PHONE_ID
    const template = process.env.WA_TEMPLATE_OTP
    if (!token || !idNomor || !template) throw new Error('Konfigurasi WhatsApp belum lengkap')
    const res = await fetch(`https://graph.facebook.com/v21.0/${idNomor}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: nomorHp,
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WA_TEMPLATE_BAHASA ?? 'id' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: kode }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: kode }] },
          ],
        },
      }),
    })
    if (!res.ok) {
      const galat = (await res.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null
      this.log.error(`WhatsApp menolak pengiriman [${res.status}] kode ${galat?.error?.code ?? '-'}: ${galat?.error?.message ?? 'tanpa keterangan'}`)
      throw new Error(`WhatsApp menolak pengiriman (${res.status})`)
    }
  }
}
