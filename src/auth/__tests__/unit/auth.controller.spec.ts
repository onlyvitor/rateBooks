import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './auth.guard';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  const loginDto: LoginDto = {
    email: 'john@example.com',
    password: 'plainPassword123',
  };

  const mockLoginResponse = {
    success: true,
    data: {
      accessToken: 'access-token-xyz',
      refreshToken: 'refresh-token-xyz',
    },
    message: 'Login successful',
  };

  const mockRefreshResponse = {
    success: true,
    data: {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    },
  };

  const mockAuthService = {
    login: jest.fn(),
    refreshTokens: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn(), verifyAsync: jest.fn() },
        },
        {
          provide: Reflector,
          useValue: { get: jest.fn(), getAllAndOverride: jest.fn().mockReturnValue(true) },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login with DTO and return result', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      const result = await controller.login(loginDto);

      expect(service.login).toHaveBeenCalledWith(loginDto);
      expect(service.login).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockLoginResponse);
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Invalid credentials');
      mockAuthService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow(error);
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });

    it('should handle admin login dto', async () => {
      const adminDto: LoginDto = { email: 'admin@example.com', password: 'admin123' };
      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      await controller.login(adminDto);

      expect(service.login).toHaveBeenCalledWith(adminDto);
    });
  });

  describe('getProfile', () => {
    it('should return req.user', () => {
      const mockUser = { sub: 1, email: 'john@example.com', isAdmin: false };
      const mockReq = { user: mockUser } as any;

      const result = controller.getProfile(mockReq);

      expect(result).toEqual(mockUser);
    });

    it('should return admin user profile', () => {
      const mockAdmin = { sub: 2, email: 'admin@example.com', isAdmin: true };
      const mockReq = { user: mockAdmin } as any;

      const result = controller.getProfile(mockReq);

      expect(result).toEqual(mockAdmin);
      expect(result.isAdmin).toBe(true);
    });

    it('should return exactly req.user reference', () => {
      const mockUser = { sub: 99, email: 'test@test.com', isAdmin: false, extra: 'field' };
      const mockReq = { user: mockUser } as any;

      const result = controller.getProfile(mockReq);

      expect(result).toBe(mockUser);
    });
  });

  describe('refresh', () => {
    it('should call authService.refreshTokens with refreshToken and return result', async () => {
      mockAuthService.refreshTokens.mockResolvedValue(mockRefreshResponse);

      const result = await controller.refresh('valid-refresh-token');

      expect(service.refreshTokens).toHaveBeenCalledWith('valid-refresh-token');
      expect(service.refreshTokens).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRefreshResponse);
    });

    it('should pass exact token string to service', async () => {
      mockAuthService.refreshTokens.mockResolvedValue(mockRefreshResponse);
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

      await controller.refresh(token);

      expect(service.refreshTokens).toHaveBeenCalledWith(token);
    });

    it('should propagate errors from service on refresh', async () => {
      const error = new Error('Invalid refresh token');
      mockAuthService.refreshTokens.mockRejectedValue(error);

      await expect(controller.refresh('invalid-token')).rejects.toThrow(error);
      expect(service.refreshTokens).toHaveBeenCalledWith('invalid-token');
    });

    it('should handle empty token string', async () => {
      mockAuthService.refreshTokens.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(controller.refresh('')).rejects.toThrow();
      expect(service.refreshTokens).toHaveBeenCalledWith('');
    });
  });
});
