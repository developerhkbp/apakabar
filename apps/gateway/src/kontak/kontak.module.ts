import { Global, Module } from '@nestjs/common'
import { KontakController } from './kontak.controller'
import { KontakService } from './kontak.service'

@Global()
@Module({ controllers: [KontakController], providers: [KontakService], exports: [KontakService] })
export class KontakModule {}
