import { Module } from '@nestjs/common'
import { PesanModule } from '../pesan/pesan.module'
import { SinkronModule } from '../sinkron/sinkron.module'
import { AdminController } from './admin.controller'

@Module({ imports: [PesanModule, SinkronModule], controllers: [AdminController] })
export class AdminModule {}
