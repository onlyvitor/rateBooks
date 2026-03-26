import { IsEnum, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { Status } from '../status.enum';

export class CreateRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @IsString()
  @IsNotEmpty()
  comment: string;

  @IsEnum(Status)
  status: Status;

  @IsString()
  @IsNotEmpty()
  googleBookId: string;

  @IsInt()
  userId: number;
}
