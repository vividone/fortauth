import { IsString, IsNotEmpty, Length } from 'class-validator';

export class EnableMfaDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class DisableMfaDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RegenerateBackupCodesDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}
