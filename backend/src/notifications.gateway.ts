import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from './prisma.service'; // DODANO: dostęp do bazy

@WebSocketGateway({
  cors: { origin: '*' }, // Pozwalamy na połączenia z frontendu
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  // Wstrzyknięcie PrismaService, aby sprawdzić ustawienia
  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    // SPRAWDZANIE CZY MODUŁ TV JEST AKTYWNY
    const settings = await this.prisma.settings.findFirst();
    
    if (!settings?.isTvModuleActive) {
      console.log(`🚫 Próba połączenia TV (${client.id}), ale moduł jest obecnie WYŁĄCZONY.`);
      client.disconnect(); // Rozłączamy klienta, jeśli moduł jest nieaktywny
      return;
    }

    console.log(`🔌 Nowe połączenie (Moduł TV Aktywny): ${client.id}`);
  }

  // Funkcja, którą będziemy wywoływać z innych serwisów
  broadcastUpdate(event: string, data: any) {
    this.server.emit(event, data);
  }
}