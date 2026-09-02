import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OwnerOrAdminGuard, OWNER_KEY } from '../../guards/owner-or-admin.guard';

describe('OwnerOrAdminGuard', () => {
  let guard: OwnerOrAdminGuard;
  let reflector: jest.Mocked<Reflector>;

  const mockReflector = {
    get: jest.fn(),
    getAllAndOverride: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = mockReflector as unknown as jest.Mocked<Reflector>;
    guard = new OwnerOrAdminGuard(reflector);
  });

  function createContext(
    params: Record<string, string> = {},
    user?: any,
  ): ExecutionContext {
    const request: any = {
      params,
      user,
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

  describe('user not authenticated', () => {
    it('should throw ForbiddenException when request.user is undefined', () => {
      mockReflector.get.mockReturnValue(undefined);
      const context = createContext({ id: '1' }, undefined);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });

    it('should throw ForbiddenException when request.user is null', () => {
      mockReflector.get.mockReturnValue(undefined);
      const context = createContext({ id: '1' }, null);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should not call reflector if user missing (throws before)', () => {
      // Actually guard checks user first before reflector, so reflector not called? Let's check implementation: it checks user first, then reflector.
      // Wait code order: const request = ..., const user = request.user, if (!user) throw, then if user.isAdmin return true, then reflector.get.
      // So reflector should not be called if no user.
      // But our implementation does check reflector after user checks, so ensure.
      mockReflector.get.mockClear();
      const context = createContext({ id: '1' }, undefined);
      try {
        guard.canActivate(context);
      } catch {}
      // reflector.get should not have been called because it threw before
      // Actually it will still not be called, we verify
      expect(mockReflector.get).not.toHaveBeenCalled();
    });
  });

  describe('admin bypass', () => {
    it('should return true when user is admin regardless of id', () => {
      mockReflector.get.mockReturnValue('id');
      const context = createContext({ id: '999' }, { sub: 1, isAdmin: true });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should return true for admin even when params empty', () => {
      mockReflector.get.mockReturnValue('id');
      const context = createContext({}, { sub: 5, isAdmin: true });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should not check resourceId when admin', () => {
      mockReflector.get.mockReturnValue('id');
      const context = createContext({ id: '1' }, { sub: 999, isAdmin: true });

      const result = guard.canActivate(context);
      expect(result).toBe(true);
      // reflector may still be called? Actually code checks isAdmin before reflector.
      // Let's verify order: if user.isAdmin return true before reflector. So reflector not called for admin.
      // So we expect reflector not essential but check not throws.
    });
  });

  describe('owner check', () => {
    it('should return true when user.sub matches :id param', () => {
      mockReflector.get.mockReturnValue(undefined); // fallback to 'id'
      const context = createContext({ id: '1' }, { sub: 1, isAdmin: false });

      expect(guard.canActivate(context)).toBe(true);
      expect(mockReflector.get).toHaveBeenCalledWith(OWNER_KEY, context.getHandler());
    });

    it('should use default param id when reflector returns undefined', () => {
      mockReflector.get.mockReturnValue(undefined);
      const context = createContext({ id: '42' }, { sub: 42, isAdmin: false });

      expect(guard.canActivate(context)).toBe(true);
      expect(mockReflector.get.mock.calls[0][0]).toBe(OWNER_KEY);
    });

    it('should use custom param name when reflector returns custom key', () => {
      mockReflector.get.mockReturnValue('userId');
      const context = createContext({ userId: '10' }, { sub: 10, isAdmin: false });

      expect(guard.canActivate(context)).toBe(true);
      expect(mockReflector.get).toHaveBeenCalledWith(OWNER_KEY, context.getHandler());
    });

    it('should convert string param to number via Number()', () => {
      mockReflector.get.mockReturnValue('id');
      const context = createContext({ id: '123' }, { sub: 123, isAdmin: false });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException when user.sub does not match resourceId', () => {
      mockReflector.get.mockReturnValue('id');
      const context = createContext({ id: '2' }, { sub: 1, isAdmin: false });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('You can only modify your own resources');
    });

    it('should throw when resourceId is NaN (params missing)', () => {
      mockReflector.get.mockReturnValue('id');
      const context = createContext({}, { sub: 1, isAdmin: false });
      // Number(undefined) = NaN, 1 !== NaN => throw
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw when param is non-numeric string', () => {
      mockReflector.get.mockReturnValue('id');
      const context = createContext({ id: 'abc' }, { sub: 1, isAdmin: false });
      // Number('abc') = NaN => throw
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should handle 0 id correctly', () => {
      mockReflector.get.mockReturnValue('id');
      const context = createContext({ id: '0' }, { sub: 0, isAdmin: false });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should check strict equality (===) between sub and resourceId', () => {
      mockReflector.get.mockReturnValue('id');
      // sub as string vs number should not match? Guard uses Number(param) => number, sub expected number.
      // If sub is string "1" and param "1" => Number("1")=1, "1" !==1 -> throw
      const context = createContext({ id: '1' }, { sub: '1' as any, isAdmin: false });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow owner with custom param where ids match', () => {
      mockReflector.get.mockReturnValue('customId');
      const context = createContext({ customId: '5', id: '99' }, { sub: 5, isAdmin: false });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny when custom param mismatches even if default id matches', () => {
      mockReflector.get.mockReturnValue('customId');
      const context = createContext({ customId: '99', id: '1' }, { sub: 1, isAdmin: false });
      // guard will look at customId=99, not id=1 => 1 !==99 => throw
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('integration style', () => {
    it('should throw with ForbiddenException containing correct response', () => {
      mockReflector.get.mockReturnValue('id');
      const context = createContext({ id: '2' }, { sub: 1, isAdmin: false });

      try {
        guard.canActivate(context);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ForbiddenException);
        const response = (e as ForbiddenException).getResponse() as any;
        // Nest ForbiddenException wraps message in object with message, error, statusCode
        expect(response.message).toContain('You can only modify your own resources');
      }
    });
  });
});
