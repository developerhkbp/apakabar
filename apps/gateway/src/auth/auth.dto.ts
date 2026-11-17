import { Type } from 'class-transformer'
import { IsString, Length, Matches, ValidateNested } from 'class-validator'
import { PaketPerangkatDto } from '../common/dto-perangkat'

export class MintaOtpDto {
  @IsString({ message: 'Nomor HP wajib diisi' }) nomorHp: string
}

export class VerifikasiOtpDto {
  @IsString() nomorHp: string
  @Matches(/^\d{6}$/, { message: 'Kode harus 6 digit' }) kode: string
  @ValidateNested() @Type(() => PaketPerangkatDto) perangkat: PaketPerangkatDto
}

export class RefreshDto {
  @IsString() @Length(20, 2000) refreshToken: string
}
