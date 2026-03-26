import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(private readonly usersService: UsersService, private readonly jwtService: JwtService) { }

    async login(loginDto: LoginDto) {
        const user = await this.usersService.findByEmail(loginDto.email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = { sub: user.id, email: user.email, isAdmin: user.isAdmin };
        return {
            success: true,
            data: {
                accessToken: this.jwtService.sign({ ...payload, type: 'access' }, { expiresIn: '15m' }),
                refreshToken: this.jwtService.sign({ ...payload, type: 'refresh' }, { expiresIn: '7d' }),
            },
            message: 'Login successful',
        };
    }

    async refreshTokens(token: string) {
        try {
            const payload = this.jwtService.verify(token);

            if (payload.type !== 'refresh') {
                throw new UnauthorizedException('Invalid token type');
            }

            const newAccessToken = this.jwtService.sign(
                { sub: payload.sub, email: payload.email, isAdmin: payload.isAdmin, type: 'access' },
                { expiresIn: '15m' },
            );
            const newRefreshToken = this.jwtService.sign(
                { sub: payload.sub, email: payload.email, isAdmin: payload.isAdmin, type: 'refresh' },
                { expiresIn: '7d' },
            );

            return { success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } };
        } catch (e) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }
}
