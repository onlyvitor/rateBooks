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
            throw new Error('User not found');
        }
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid password');
        }

        const payload = { sub: user.id, email: user.email };
        return { success: true, data: { token: this.jwtService.sign(payload) }, refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }), message: 'Login successful' };
    }

    async refreshTokens(token: string) {
        try {
            const payload = this.jwtService.verify(token);
            const newAccessToken = this.jwtService.sign({ email: payload.email }, { expiresIn: '15m' });
            const newRefreshToken = this.jwtService.sign({ email: payload.email }, { expiresIn: '7d' });

            return { success: true, data: { access_token: newAccessToken, refresh_token: newRefreshToken } };
        } catch (e) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }
}
