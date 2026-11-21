
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateUserValidation } from './validation/create-user.validation';
import { UpdateUserValidation } from './validation/update-user.validation';
import { UpdateUserStatusValidation } from './validation/update-user-status.validation';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

interface AuthenticatedUser {
  userId: string;
  roles: string[];
}

@RequireModule(MODULE_KEYS.USER_MANAGEMENT)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users?page=1&limit=10&search=&role=&status=
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: 'active' | 'inactive',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll(user, {
      search,
      role,
      status,
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Math.max(1, Number(limit) || 10)),
    });
  }

  // GET /users/:id
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.findOne(user, id);
  }

  // POST /users
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
   @Body() body: CreateUserValidation
  ) {
    return this.usersService.create(user, body);
  }

  // PATCH /users/:id
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
   @Body() body: UpdateUserValidation
  ) {
    return this.usersService.update(user, id, body);
  }

  // PATCH /users/:id/status
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.usersService.updateStatus(
      user,
      id,
      body.isActive,
    );
  }

  // DELETE /users/:id
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.remove(user, id);
  }
}
