// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // --- DODAJ TĘ LINIJKĘ ---
  app.enableCors(); 
  // ------------------------

  const config = new DocumentBuilder()
    .setTitle('Med Clinic API')
    .setDescription('System rezerwacji wizyt lekarskich')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();