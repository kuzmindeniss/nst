import { Type } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit: number = 10;
}

export class PageMetaDto {
  itemCount: number;
  totalItems?: number;
  itemsPerPage: number;
  totalPages?: number;
  currentPage: number;
}

export class PaginatedResponseDto<T> {
  readonly items: T[];
  readonly meta: PageMetaDto;
}
