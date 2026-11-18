import { Global, Module } from '@nestjs/common'
import { PesanModule } from '../pesan/pesan.module'
import { GrupController } from './grup.controller'
import { GrupService } from './grup.service'
import { GrupOtomatisService } from './grup-otomatis.service'

@Global()
@Module({ imports: [PesanModule], controllers: [GrupController], providers: [GrupService, GrupOtomatisService], exports: [GrupService, GrupOtomatisService] })
export class GrupModule {}
