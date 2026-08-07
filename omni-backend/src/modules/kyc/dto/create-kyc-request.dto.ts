import { ArrayMaxSize, ArrayMinSize, IsString, IsUUID } from 'class-validator';

export class CreateKycRequestDto {
  @IsUUID()
  businessId!: string;

  // Storage references (e.g. object keys), not the files themselves --
  // file upload/storage is a separate concern this DTO doesn't model.
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  documents!: string[];
}
