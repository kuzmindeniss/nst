import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

export class SearchQueryDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  login?: string;
}
