import { IsNumber, IsString, Min } from 'class-validator';

export class TransferDto {
  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsNumber()
  @Min(0.01)
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;
}
