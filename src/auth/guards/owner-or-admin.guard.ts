import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const OWNER_KEY = 'ownerKey';

/**
 * Guard that checks if the current user is either:
 * - An admin (isAdmin === true)
 * - The owner of the resource (req.user.sub matches the resource's userId or the :id param)
 *
 * Use with @SetMetadata(OWNER_KEY, 'paramName') to specify which route param holds the owner ID.
 * For rating routes, set mode to 'rating' so the guard checks the rating's userId instead.
 */
@Injectable()
export class OwnerOrAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Admins can do anything
    if (user.isAdmin) {
      return true;
    }

    const ownerParam = this.reflector.get<string>(OWNER_KEY, context.getHandler()) || 'id';
    const resourceId = Number(request.params[ownerParam]);

    // For user routes: the :id param IS the userId
    // For rating routes: we need to check later in the service (attach user to request)
    if (user.sub === resourceId) {
      return true;
    }

    throw new ForbiddenException('You can only modify your own resources');
  }
}
