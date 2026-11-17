import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService, PENGIRIM_OTP } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { PengirimOtpDev, PengirimOtpWhatsapp } from './pengirim-otp'

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    PengirimOtpDev,
    PengirimOtpWhatsapp,
    {
      provide: PENGIRIM_OTP,
      inject: [PengirimOtpDev, PengirimOtpWhatsapp],
      useFactory: (dev: PengirimOtpDev, wa: PengirimOtpWhatsapp) =>
        process.env.OTP_PENGIRIM === 'whatsapp' ? wa : dev,
    },
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
