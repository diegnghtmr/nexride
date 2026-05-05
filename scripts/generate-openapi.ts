/**
 * generate-openapi.ts
 * Bootstraps the NestJS application context headlessly, generates the OpenAPI
 * document, and writes it to dist/openapi.json.
 *
 * Usage: ts-node scripts/generate-openapi.ts
 * Or via npm: npm run openapi:generate
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';

async function generate() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // Suppress startup logs during generation
  });

  const config = new DocumentBuilder()
    .setTitle('NexRide MVP API')
    .setDescription('Dispatch vertical slice — ride request, confirmation, safe points management')
    .setVersion('0.1.0')
    .addTag('rides', 'Ride request and confirmation')
    .addTag('safe-points', 'Safe pickup point management')
    .addTag('health', 'Service health')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'openapi.json');
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI document written to ${outPath}`);

  await app.close();
}

generate().catch((err) => {
  console.error('Failed to generate OpenAPI document:', err);
  process.exit(1);
});
