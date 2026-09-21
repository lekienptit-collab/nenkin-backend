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
  CreateWorkerDto,
  GetManyWorkerDto,
  SearchWorkerDto,
  UpdateNenkinResultDto,
  UpdateWorkerDto,
} from './dto/worker.dto';
import { WorkerService } from './services/workers.service';

@ApiTags('Workers')
@Controller('workers')
@ApiBearerAuth()
export class WorkerController {
  constructor(private readonly service: WorkerService) {}

  @Get('/search')
  @UseGuards(TokenGuard)
  @ApiOperation({
    description: 'Tìm nhanh người lao động (dùng cho select box)',
  })
  async search(@Query() params: SearchWorkerDto) {
    return this.service.search(params.keyword);
  }

  @Get()
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_WORKER)
  @ApiOperation({ description: 'Danh sách người lao động (phân trang)' })
  async getMany(@Query() params: GetManyWorkerDto) {
    return this.service.getMany(params);
  }

  @Get(':id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_WORKER)
  @ApiOperation({ description: 'Chi tiết người lao động' })
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.CREATE_WORKER)
  async createOne(
    @Body() payload: CreateWorkerDto,
    @CurrentUser() user: UserIdentity,
  ) {
    return this.service.create(payload, user?.sub);
  }

  @Patch(':id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.UPDATE_WORKER)
  async updateOne(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateWorkerDto,
    @CurrentUser() user: UserIdentity,
  ) {
    return this.service.update(id, payload, user?.sub);
  }

  @Patch(':id/nenkin-result')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.UPDATE_NENKIN_RESULT)
  @ApiOperation({ description: 'Đổi trạng thái đã trả kết quả Nenkin' })
  async updateNenkinResult(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateNenkinResultDto,
  ) {
    return this.service.updateNenkinResult(id, payload);
  }

  @Delete('/')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.DELETE_WORKER)
  @ApiOperation({ description: 'Xoá nhiều người lao động' })
  async delete(@Body() payload: IdsDto) {
    return this.service.deleteMulti(payload.ids);
  }
}
