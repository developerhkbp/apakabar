import { Global, Injectable, Module } from '@nestjs/common'
import { EventEmitter } from 'events'

/** Penghubung ringan antar modul (dalam satu proses) agar modul yang saling bergantung tidak perlu saling impor. */
@Injectable()
export class PeristiwaService extends EventEmitter {}

@Global()
@Module({ providers: [PeristiwaService], exports: [PeristiwaService] })
export class PeristiwaModule {}
