import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolePers } from 'src/common/constatns/role';
import {
  CurrentUser,
  TokenGuard,
  UserIdentity,
} from 'src/common/decorator/auth.decorator';
import { RolesGuard } from 'src/common/decorator/roles.guard';
import { CUseRoles } from 'src/common/decorator/user.role';
import { IdsDto } from 'src/common/dto/ids.dto';
import {
  CreateAgentDto,
  GetManyAgentDto,
  SearchAgentDto,
  UpdateAgentDto,
} from './dto/agent.dto';
import { AgentService } from './services/agents.service';

@ApiTags('Agents')
@Controller('agents')
@ApiBearerAuth()
export class AgentController {
  constructor(private readonly service: AgentService) {}

  @Get('/search')
  @UseGuards(TokenGuard)
  @ApiOperation({
    description: 'Tìm nhanh người đại diện (dùng cho select box)',
  })
  async search(@Query() params: SearchAgentDto) {
    return this.service.search(params.keyword);
  }

  @Get()
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_AGENT)
  @ApiOperation({ description: 'Danh sách người đại diện (phân trang)' })
  async getMany(@Query() params: GetManyAgentDto) {
    return this.service.getMany(params);
  }

  @Get(':id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_AGENT)
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.CREATE_AGENT)
  async createOne(
    @Body() payload: CreateAgentDto,
    @CurrentUser() user: UserIdentity,
  ) {
    return this.service.create(payload, user?.sub);
  }

  @Patch(':id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.UPDATE_AGENT)
  async updateOne(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateAgentDto,
    @CurrentUser() user: UserIdentity,
  ) {
    return this.service.update(id, payload, user?.sub);
  }

  @Delete('/')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.DELETE_AGENT)
  @ApiOperation({ description: 'Xoá nhiều người đại diện' })
  async delete(@Body() payload: IdsDto) {
    return this.service.deleteMulti(payload.ids);
  }
}
