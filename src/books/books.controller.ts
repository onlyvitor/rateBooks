import { Controller, Get, Param, Query } from '@nestjs/common';
import { GoogleBooksService } from './google-books.service';

@Controller('books')
export class BooksController {
  constructor(private readonly googleBooksService: GoogleBooksService) {}

  @Get('search')
  search(@Query('q') query: string) {
    return this.googleBooksService.searchBooks(query);
  }

  @Get(':googleBookId')
  findOne(@Param('googleBookId') googleBookId: string) {
    return this.googleBooksService.getBookById(googleBookId);
  }
}
