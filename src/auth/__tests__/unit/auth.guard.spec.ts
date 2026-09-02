import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../../auth.guard';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let reflector: jest.Mocked<Reflector>;

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    reflector = mockReflector as unknown as jest.Mocked<Reflector>;
    jwtService = mockJwtService as unknown as jest.Mocked<JwtService>;
    guard = new AuthGuard(jwtService, reflector);
  });

  function createExecutionContext(
    headers: Record<string, string | undefined> = {},
    user?: any,
  ): ExecutionContext {
    const request: any = {
      headers,
      user,
      params: {},
    };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getType: () => 'http',
      getArgs: () => [],
      getArgByIndex: () => null,
      switchToRpc: () => null as any,
      switchToWs: () => null as any,
    } as unknown as ExecutionContext;
  }

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('isPublic route', () => {
    it('should return true without checking token when route is public', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should allow even if no authorization header when public', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createExecutionContext({});

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });

  describe('no token provided', () => {
    beforeEach(() => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
    });

    it('should throw UnauthorizedException when no authorization header', async () => {
      const context = createExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('No token provided');
    });

    it('should throw when authorization header is undefined', async () => {
      const context = createExecutionContext({ authorization: undefined });

      await expect(guard.canActivate(context)).rejects.toThrow('No token provided');
    });

    it('should throw when authorization header type is not Bearer', async () => {
      const context = createExecutionContext({ authorization: 'Basic some-token' });

      await expect(guard.canActivate(context)).rejects.toThrow('No token provided');
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should throw when authorization is Bearer without token (empty token)', async () => {
      // "Bearer " split -> ["Bearer", ""] => token = ""? Actually second element is "" -> falsy?
      // guard checks if (!token) throw, so should throw No token provided
      // For "Bearer " split gives ["Bearer", ""], token = "" which is falsy -> throws
      const context = createExecutionContext({ authorization: 'Bearer ' });

      // token extracted is "" -> but code returns type === 'Bearer' ? token : undefined => returns ""
      // then if (!token) => true (empty string falsy), so throws No token provided *or* verify fails?
      // Our guard: if (!token) throw No token provided
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      // Depending on implementation it may throw Invalid token if verify called with ""
      // But we assert it throws UnauthorizedException either way
    });

    it('should throw when header is empty string', async () => {
      const context = createExecutionContext({ authorization: '' });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('token verification', () => {
    beforeEach(() => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
    });

    it('should verify token and attach user to request', async () => {
      const decoded = { sub: 1, email: 'john@example.com', isAdmin: false, type: 'access' };
      mockJwtService.verifyAsync.mockResolvedValue(decoded);

      const context = createExecutionContext({ authorization: 'Bearer valid-token' });
      const request = context.switchToHttp().getRequest();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
      expect(request.user).toEqual(decoded);
    });

    it('should handle admin user payload', async () => {
      const decoded = { sub: 2, email: 'admin@example.com', isAdmin: true, type: 'access' };
      mockJwtService.verifyAsync.mockResolvedValue(decoded);

      const context = createExecutionContext({ authorization: 'Bearer admin-token' });
      const request = context.switchToHttp().getRequest();

      await guard.canActivate(context);

      expect(request.user.isAdmin).toBe(true);
      expect(request.user.sub).toBe(2);
    });

    it('should throw UnauthorizedException when token type is refresh', async () => {
      const decoded = { sub: 1, email: 'john@example.com', isAdmin: false, type: 'refresh' };
      mockJwtService.verifyAsync.mockResolvedValue(decoded);

      const context = createExecutionContext({ authorization: 'Bearer refresh-token' });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Refresh tokens cannot be used for authentication');
    });

    it('should throw with original error message when verifyAsync throws with message', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      const context = createExecutionContext({ authorization: 'Bearer expired-token' });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('jwt expired');
    });

    it('should throw Invalid token when verifyAsync throws without message', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error(''));

      const context = createExecutionContext({ authorization: 'Bearer token' });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      // e.message is "" falsy, so guard throws 'Invalid token'
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid token');
    });

    it('should throw when verifyAsync throws generic object without message', async () => {
      mockJwtService.verifyAsync.mockRejectedValue({} as any);

      const context = createExecutionContext({ authorization: 'Bearer token' });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw wrapped UnauthorizedException when verifyAsync rejects with UnauthorizedException for refresh token', async () => {
      // Refresh token case throws UnauthorizedException with message 'Refresh tokens cannot be used for authentication'
      // but then caught in catch(e) => throw UnauthorizedException(e.message)
      // So we test that flow produces same message
      const decoded = { sub: 1, type: 'refresh' };
      mockJwtService.verifyAsync.mockResolvedValue(decoded);

      const context = createExecutionContext({ authorization: 'Bearer refresh-token' });

      try {
        await guard.canActivate(context);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        expect((e as UnauthorizedException).message).toBe('Refresh tokens cannot be used for authentication');
      }
    });

    it('should extract token correctly only when Bearer', async () => {
      const decoded = { sub: 1, type: 'access' };
      mockJwtService.verifyAsync.mockResolvedValue(decoded);

      const contextBearer = createExecutionContext({ authorization: 'Bearer mytoken123' });
      await guard.canActivate(contextBearer);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('mytoken123');

      jest.clearAllMocks();
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue(decoded);
      const contextLower = createExecutionContext({ authorization: 'bearer mytoken123' });
      // 'bearer' !== 'Bearer' => token undefined => throws No token provided
      await expect(guard.canActivate(contextLower)).rejects.toThrow('No token provided');
    });

    it('should call reflector with correct arguments', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1, type: 'access' });

      const context = createExecutionContext({ authorization: 'Bearer token' });

      await guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
      expect(mockReflector.getAllAndOverride.mock.calls[0][0]).toBe(IS_PUBLIC_KEY);
      expect(mockReflector.getAllAndOverride.mock.calls[0][1]).toHaveLength(2);
    });
  });

  describe('extractTokenFromHeader private logic via canActivate', () => {
    beforeEach(() => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1, type: 'access' });
    });

    it('should handle multiple spaces in header gracefully (split returns first token part)', async () => {
      // header "Bearer token extra" split by ' ' => ["Bearer", "token", "extra"] but destructuring gets only [type, token] = ["Bearer", "token"]
      // So it will use "token"
      const context = createExecutionContext({ authorization: 'Bearer token extra' });
      await guard.canActivate(context);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('token');
    });

    it('should return undefined when header has no space', async () => {
      const context = createExecutionContext({ authorization: 'BearerTokenWithoutSpace' });
      await expect(guard.canActivate(context)).rejects.toThrow('No token provided');
    });
  });
});
