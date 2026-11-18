import { Module } from '@nestjs/common'
import { SinkronService } from './sinkron.service'

@Module({ providers: [SinkronService], exports: [SinkronService] })
export class SinkronModule {}
