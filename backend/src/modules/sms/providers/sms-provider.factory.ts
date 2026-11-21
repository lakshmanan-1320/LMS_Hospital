import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SmsProvider } from '../interfaces/sms-provider.interface';
import { Msg91Provider } from './msg91.provider';
import { MockSmsProvider } from './mock-sms.provider';

@Injectable()
export class SmsProviderFactory {
  constructor(
    @Inject(Msg91Provider) private readonly msg91Provider: Msg91Provider,
    @Inject(MockSmsProvider) private readonly mockSmsProvider: MockSmsProvider,
  ) {}

  getProvider(providerKey: string = 'msg91'): SmsProvider {
    switch (providerKey.toLowerCase()) {
      case 'msg91':
        return this.msg91Provider;
      case 'mock':
        return this.mockSmsProvider;
      default:
        return this.msg91Provider;
    }
  }

  listProviders(): Array<{ key: string; name: string; fields: any[] }> {
    return [
      {
        key: this.msg91Provider.key,
        name: this.msg91Provider.name,
        fields: this.msg91Provider.fields,
      },
      {
        key: this.mockSmsProvider.key,
        name: this.mockSmsProvider.name,
        fields: this.mockSmsProvider.fields,
      },
    ];
  }
}
