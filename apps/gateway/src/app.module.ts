import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { PrekeyModule } from './prekey/prekey.module'
import { PesanModule } from './pesan/pesan.module'
import { PushModule } from './push/push.module'
import { GrupModule } from './grup/grup.module'
import { AdminModule } from './admin/admin.module'
import { BerkasModule } from './berkas/berkas.module'
import { FotoModule } from './foto/foto.module'

@Module({ imports: [PrismaModule, AuthModule, PrekeyModule, PesanModule, PushModule, GrupModule, AdminModule, BerkasModule, FotoModule] })
export class AppModule {}
