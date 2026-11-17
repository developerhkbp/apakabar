import { Global, Module } from '@nestjs/common'
import { PesanModule } from '../pesan/pesan.module'
import { GrupController } from './grup.controller'
import { GrupService } from './grup.service'

@Global()
@Module({ imports: [PesanModule], controllers: [GrupController], providers: [GrupService], exports: [GrupService] })
export class GrupModule {}
