import 'dotenv/config'
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { WsAdapter } from '@nestjs/platform-ws'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // Di belakang ingress/load balancer, IP klien ada di X-Forwarded-For; tanpa ini semua permintaan tampak berasal dari satu IP.
  if (process.env.TRUST_PROXY) app.getHttpAdapter().getInstance().set('trust proxy', parseInt(process.env.TRUST_PROXY, 10) || 1)
  app.useWebSocketAdapter(new WsAdapter(app))
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableShutdownHooks()
  const port = parseInt(process.env.PORT ?? '3101', 10)
  await app.listen(port, '0.0.0.0')
  console.log(`ApaKabaR gateway berjalan di port ${port}`)
}
bootstrap()
