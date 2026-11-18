import { Module } from '@nestjs/common'
import { PesanGateway } from './pesan.gateway'
import { PresensiController } from './presensi.controller'

@Module({ providers: [PesanGateway], controllers: [PresensiController], exports: [PesanGateway] })
export class PesanModule {}
