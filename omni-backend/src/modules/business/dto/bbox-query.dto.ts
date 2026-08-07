import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class BboxQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  south!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  west!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  north!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  east!: number;
}
