import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let bcryptCompareMock: jest.Mock;

  const mockUser = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedPassword123',
    isAdmin: false,
    ratings: [],
  };

  const mockAdminUser = {
    ...mockUser,
    id: 2,
    email: 'admin@example.com',
    isAdmin: true,
  };

  const loginDto = {
    email: 'john@example.com',
    password: 'plainPassword123',
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    bcryptCompareMock = bcrypt.compare as unknown as jest.Mock;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should login successfully and return access and refresh tokens', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser as any);
      bcryptCompareMock.mockResolvedValue(true);
      mockJwtService.sign
        .mockReturnValueOnce('access-token-xyz')
        .mockReturnValueOnce('refresh-token-xyz');

      const result = await service.login(loginDto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(usersService.findByEmail).toHaveBeenCalledTimes(1);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
      expect(result).toEqual({
        success: true,
        data: {
          accessToken: 'access-token-xyz',
          refreshToken: 'refresh-token-xyz',
        },
        message: 'Login successful',
      });
    });

    it('should call jwtService.sign with correct payload and expiration for access token', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser as any);
      bcryptCompareMock.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('token');

      await service.login(loginDto);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: mockUser.id, email: mockUser.email, isAdmin: mockUser.isAdmin, type: 'access' },
        { expiresIn: '15m' },
      );
    });

    it('should call jwtService.sign with correct payload and expiration for refresh token', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser as any);
      bcryptCompareMock.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('token');

      await service.login(loginDto);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: mockUser.id, email: mockUser.email, isAdmin: mockUser.isAdmin, type: 'refresh' },
        { expiresIn: '7d' },
      );
    });

    it('should handle admin user payload correctly', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockAdminUser as any);
      bcryptCompareMock.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('token');

      await service.login({ email: mockAdminUser.email, password: 'plainPassword123' });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: mockAdminUser.id, isAdmin: true, type: 'access' }),
        expect.any(Object),
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: mockAdminUser.id, isAdmin: true, type: 'refresh' }),
        expect.any(Object),
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
      expect(bcryptCompareMock).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser as any);
      bcryptCompareMock.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should not call jwtService.sign if bcrypt compare fails', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser as any);
      bcryptCompareMock.mockResolvedValue(false);

      try {
        await service.login(loginDto);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        expect(mockJwtService.sign).not.toHaveBeenCalled();
      }
    });

    it('should propagate error if usersService.findByEmail throws', async () => {
      const error = new Error('DB error');
      mockUsersService.findByEmail.mockRejectedValue(error);

      await expect(service.login(loginDto)).rejects.toThrow(error);
    });
  });

  describe('refreshTokens', () => {
    const validRefreshPayload = {
      sub: 1,
      email: 'john@example.com',
      isAdmin: false,
      type: 'refresh',
    };

    const accessPayload = {
      sub: 1,
      email: 'john@example.com',
      isAdmin: false,
      type: 'access',
    };

    it('should refresh tokens successfully when valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue(validRefreshPayload);
      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshTokens('valid-refresh-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-refresh-token');
      expect(result).toEqual({
        success: true,
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      });
    });

    it('should call jwtService.sign to generate new access token with 15m', async () => {
      mockJwtService.verify.mockReturnValue(validRefreshPayload);
      mockJwtService.sign.mockReturnValue('token');

      await service.refreshTokens('valid-refresh-token');

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: validRefreshPayload.sub, email: validRefreshPayload.email, isAdmin: validRefreshPayload.isAdmin, type: 'access' },
        { expiresIn: '15m' },
      );
    });

    it('should call jwtService.sign to generate new refresh token with 7d', async () => {
      mockJwtService.verify.mockReturnValue(validRefreshPayload);
      mockJwtService.sign.mockReturnValue('token');

      await service.refreshTokens('valid-refresh-token');

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: validRefreshPayload.sub, email: validRefreshPayload.email, isAdmin: validRefreshPayload.isAdmin, type: 'refresh' },
        { expiresIn: '7d' },
      );
    });

    it('should throw UnauthorizedException when token type is not refresh (access token)', async () => {
      mockJwtService.verify.mockReturnValue(accessPayload);

      await expect(service.refreshTokens('access-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshTokens('access-token')).rejects.toThrow('Invalid refresh token');
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token has no type', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1, email: 'john@example.com', isAdmin: false });

      await expect(service.refreshTokens('token-without-type')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshTokens('token-without-type')).rejects.toThrow('Invalid refresh token');
    });

    it('should throw UnauthorizedException when verify throws error (invalid token)', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshTokens('invalid-token')).rejects.toThrow('Invalid refresh token');
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when verify throws UnauthorizedException with Invalid token type', async () => {
      // Simula verify retornando payload de access que gera Invalid token type internamente
      mockJwtService.verify.mockReturnValue(accessPayload);

      try {
        await service.refreshTokens('access-token-string');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        expect((e as UnauthorizedException).message).toBe('Invalid refresh token');
      }
    });

    it('should preserve isAdmin true in new tokens', async () => {
      const adminPayload = { sub: 2, email: 'admin@example.com', isAdmin: true, type: 'refresh' };
      mockJwtService.verify.mockReturnValue(adminPayload);
      mockJwtService.sign.mockReturnValue('token');

      await service.refreshTokens('admin-refresh-token');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true, sub: 2 }),
        expect.any(Object),
      );
    });

    it('should handle verify throwing generic exception and wrap as Invalid refresh token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      try {
        await service.refreshTokens('expired-token');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        const response = (e as UnauthorizedException).getResponse() as string | object;
        // UnauthorizedException default response contains message
        expect((e as UnauthorizedException).message).toContain('Invalid refresh token');
      }
    });
  });
});
