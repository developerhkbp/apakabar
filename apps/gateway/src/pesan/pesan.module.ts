import { Module } from '@nestjs/common'
import { PesanGateway } from './pesan.gateway'

@Module({ providers: [PesanGateway], exports: [PesanGateway] })
export class PesanModule {}
