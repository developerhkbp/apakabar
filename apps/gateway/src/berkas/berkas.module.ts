import { Module } from '@nestjs/common'
import { BerkasController } from './berkas.controller'
import { BerkasService } from './berkas.service'

@Module({ controllers: [BerkasController], providers: [BerkasService] })
export class BerkasModule {}
