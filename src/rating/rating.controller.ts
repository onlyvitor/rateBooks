import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req } from '@nestjs/common';
import { RatingService } from './rating.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';

@Controller('rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) { }

  @Post()
  create(@Body() createRatingDto: CreateRatingDto, @Req() req) {
    return this.ratingService.create(createRatingDto, req.user);
  }

  @Get()
  findAll(@Query('googleBookId') googleBookId?: string) {
    return this.ratingService.findAll(googleBookId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ratingService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRatingDto: UpdateRatingDto, @Req() req) {
    return this.ratingService.update(+id, updateRatingDto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.ratingService.remove(+id, req.user);
  }
}
