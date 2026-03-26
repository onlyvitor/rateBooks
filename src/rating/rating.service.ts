import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRatingDto } from './dto/create-rating.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import { Rating } from './entities/rating.entity';
import { GoogleBooksService } from '../books/google-books.service';

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    private readonly googleBooksService: GoogleBooksService,
  ) {}

  async create(createRatingDto: CreateRatingDto) {
    // Validate that the book exists on Google Books
    await this.googleBooksService.getBookById(createRatingDto.googleBookId);

    const rating = this.ratingRepository.create(createRatingDto);
    return this.ratingRepository.save(rating);
  }

  async findAll(googleBookId?: string) {
    const where: any = {};
    if (googleBookId) {
      where.googleBookId = googleBookId;
    }

    const ratings = await this.ratingRepository.find({ where, relations: ['user'] });

    // Enrich each rating with book data
    const ratingsWithBooks = await Promise.all(
      ratings.map(async (rating) => {
        try {
          const book = await this.googleBooksService.getBookById(rating.googleBookId);
          return { ...rating, book };
        } catch {
          return { ...rating, book: null };
        }
      }),
    );

    return ratingsWithBooks;
  }

  async findOne(id: number) {
    const rating = await this.ratingRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!rating) {
      throw new NotFoundException(`Rating #${id} não encontrado`);
    }

    try {
      const book = await this.googleBooksService.getBookById(rating.googleBookId);
      return { ...rating, book };
    } catch {
      return { ...rating, book: null };
    }
  }

  async update(id: number, updateRatingDto: UpdateRatingDto) {
    const rating = await this.ratingRepository.findOne({ where: { id } });

    if (!rating) {
      throw new NotFoundException(`Rating #${id} não encontrado`);
    }

    if (updateRatingDto.googleBookId) {
      await this.googleBooksService.getBookById(updateRatingDto.googleBookId);
    }

    Object.assign(rating, updateRatingDto);
    return this.ratingRepository.save(rating);
  }

  async remove(id: number) {
    const rating = await this.ratingRepository.findOne({ where: { id } });

    if (!rating) {
      throw new NotFoundException(`Rating #${id} não encontrado`);
    }

    return this.ratingRepository.remove(rating);
  }
}
