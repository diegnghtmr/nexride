import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use pino logger
  app.useLogger(app.get(Logger));

  // Note: global concerns are registered via AppModule providers, NOT here:
  // - HTTP security headers (helmet) via AppModule.configure() — active in
  //   integration tests too (where main.ts is not executed).
  // - ValidationPipe via APP_PIPE provider in AppModule — same reason.
  // - Domain exception filter via APP_FILTER provider in AppModule.
  // - Throttler + RBAC + TestContext guards via APP_GUARD providers in AppModule.
  // Doing it that way avoids double-registration anti-pattern (one global pipe
  // via APP_PIPE + a second via useGlobalPipes here) and keeps the wiring
  // discoverable by reading a single file.

  // Swagger setup — gated by NODE_ENV per OWASP A05 (Security Misconfiguration):
  // exposing OpenAPI/Swagger UI in production leaks the API surface to
  // attackers without authentication. Dev and CI keep it mounted because
  // generate-openapi.ts spawns a NestApplication outside `nest start`
  // anyway, and the OpenAPI artifact is emitted via build-openapi job.
  if (process.env['NODE_ENV'] !== 'production') {
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
  }

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
}

bootstrap();
