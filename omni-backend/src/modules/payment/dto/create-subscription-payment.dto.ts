import { IsPhoneNumber, IsUUID } from 'class-validator';

export class CreateSubscriptionPaymentDto {
  @IsUUID()
  businessId!: string;

  @IsUUID()
  planId!: string;

  @IsPhoneNumber('TG')
  phoneNumber!: string;
}
