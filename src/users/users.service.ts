import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: Repository<User>) { }

  async create(createUserDto: CreateUserDto) {
    const userEmail = await this.userRepository.findOne({ where: { email: createUserDto.email } });
    const userName = await this.userRepository.findOne({ where: { name: createUserDto.name } });

    if (userEmail || userName) {
      throw new BadRequestException({ success: false, message: 'User already exists' });
    }

    const user = this.userRepository.create(createUserDto);
    return await this.userRepository.save(user);
  }

  async findAll() {
    return { success: true, data: await this.userRepository.find() };
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException({ success: false, message: 'User not found' });
    }
    return { success: true, data: user };
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException({ success: false, message: 'User not found' });
    }
    return { success: true, data: await this.userRepository.update(id, updateUserDto) };
  }

  async remove(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException({ success: false, message: 'User not found' });
    }
    return { success: true, data: await this.userRepository.remove(user) };
  }
}
