import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { FotoController } from './foto.controller'

@Module({ imports: [AuthModule], controllers: [FotoController] })
export class FotoModule {}
