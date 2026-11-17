import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsInt, IsString, MaxLength, ValidateNested } from 'class-validator'

export class KunciBertandaDto {
  @IsInt() id: number
  @IsString() @MaxLength(4000) pub: string
  @IsString() @MaxLength(400) sig: string
}

export class PrekeySekaliPakaiDto {
  @IsInt() id: number
  @IsString() @MaxLength(200) pub: string
}

/** Paket kunci publik perangkat (semua byte dalam base64). Kunci privat tidak pernah dikirim. */
export class PaketPerangkatDto {
  @IsInt() regId: number
  @IsString() @MaxLength(200) identitas: string
  @ValidateNested() @Type(() => KunciBertandaDto) signedPreKey: KunciBertandaDto
  @ValidateNested() @Type(() => KunciBertandaDto) kyber: KunciBertandaDto
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => PrekeySekaliPakaiDto)
  oneTime: PrekeySekaliPakaiDto[]
}
