import { Module } from '@nestjs/common'
import { PrekeyController } from './prekey.controller'

@Module({ controllers: [PrekeyController] })
export class PrekeyModule {}
