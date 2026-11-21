export class SaveSmsConfigDto {
  providerKey: string;
  authKey?: string;
  senderId: string;
  dltEntityId?: string;
  defaultCountryCode?: string;
}

export class TestConnectionDto {
  phoneNumber?: string;
}

