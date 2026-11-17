import { Module } from '@nestjs/common'
import { PesanModule } from '../pesan/pesan.module'
import { AdminController } from './admin.controller'

@Module({ imports: [PesanModule], controllers: [AdminController] })
export class AdminModule {}
