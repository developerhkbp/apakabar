import { Module } from '@nestjs/common'
import { RedisModule } from './redis/redis.module'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { PrekeyModule } from './prekey/prekey.module'
import { PesanModule } from './pesan/pesan.module'
import { PushModule } from './push/push.module'
import { GrupModule } from './grup/grup.module'
import { AdminModule } from './admin/admin.module'
import { BerkasModule } from './berkas/berkas.module'
import { FotoModule } from './foto/foto.module'
import { SinkronModule } from './sinkron/sinkron.module'
import { KontakModule } from './kontak/kontak.module'
import { StatusModule } from './status/status.module'
import { SehatController } from './sehat.controller'
import { VersiController } from './versi.controller'
import { PeristiwaModule } from './common/peristiwa.service'

@Module({
  imports: [RedisModule, PeristiwaModule,PrismaModule, AuthModule, PrekeyModule, PesanModule, PushModule, GrupModule, AdminModule, BerkasModule, FotoModule, SinkronModule, StatusModule, KontakModule],
  controllers: [SehatController, VersiController],
})
export class AppModule {}
