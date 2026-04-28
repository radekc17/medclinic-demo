// backend/src/auth/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'bardzo_tajny_klucz_123', // To samo hasło co w auth.module.ts
    });
  }

  async validate(payload: any) {
    // To co zwrócimy tutaj, trafi do req.user w kontrolerze
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}