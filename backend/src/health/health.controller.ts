import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../common/decorators/public.decorator';
import { SkipModuleCheck } from '../common/decorators/require-module.decorator';

@SkipModuleCheck()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async getHealth() {
    return this.healthService.check();
  }
}
