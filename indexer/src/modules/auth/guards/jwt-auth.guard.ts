import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Request } from 'express';

import { AppConfigService } from '@/config/config.service';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly configSvc: AppConfigService,
    private readonly authSvc: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check for API key authentication (highest priority)
    const apiKey = request.headers['x-api-key'] as string;
    if (apiKey && apiKey === this.configSvc.api.privateKey) {
      this.logger.debug('API key authentication successful');
      // Add user info to request for logging/tracking
      request['user'] = {
        type: 'api-key',
        authenticated: true,
      };
      return true;
    }

    // Check for JWT authentication
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        const validation = await this.authSvc.validateJWT(token);

        if (validation) {
          this.logger.debug(`JWT authentication successful for address: ${validation.sub}`);
          // Add user info to request
          request['user'] = {
            type: 'jwt',
            address: validation.sub,
            jti: validation.jti,
            authenticated: true,
            admin: validation.admin,
            wallet_verified: validation.wallet_verified,
          };
          return true;
        } else {
          this.logger.warn(`JWT authentication failed: ${validation}`);
        }
      } catch (error) {
        this.logger.warn(`JWT authentication error: ${error.message}`);
      }
    }

    // No valid authentication found
    this.logger.warn('No valid authentication provided');
    return false;
  }
}

// Type declaration for the enhanced request object
declare global {
  namespace Express {
    interface Request {
      user?: {
        type: 'api-key' | 'jwt';
        address?: string;
        jti?: string;
        authenticated: boolean;
        admin?: boolean;
        wallet_verified?: boolean;
      };
    }
  }
}
