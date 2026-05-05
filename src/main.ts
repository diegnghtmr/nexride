import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use pino logger
  app.useLogger(app.get(Logger));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('NexRide MVP API')
    .setDescription('Dispatch vertical slice — ride request, confirmation, safe points management')
    .setVersion('0.1.0')
    .addTag('rides', 'Ride request and confirmation')
    .addTag('safe-points', 'Safe pickup point management')
    .addTag('health', 'Service health')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
}

bootstrap();
