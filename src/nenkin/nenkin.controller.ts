import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ErrorCode } from 'src/common/constatns/error';
import {
  NENKIN_PAPER_TEMPLATES,
  NenkinServiceType,
} from 'src/common/constatns/master-data';
import { RolePers } from 'src/common/constatns/role';
import {
  CurrentUser,
  TokenGuard,
  UserIdentity,
} from 'src/common/decorator/auth.decorator';
import { RolesGuard } from 'src/common/decorator/roles.guard';
import { CUseRoles } from 'src/common/decorator/user.role';
import { CBadRequestException } from 'src/common/exceptions/bad-request.exception';
import { UploadService } from 'src/uploads/uploads.service';
import { CreateNenkinProcedureDto, GetProceduresDto } from './dto/nenkin.dto';
import { NenkinService } from './services/nenkin.service';

@ApiTags('Nenkin')
@Controller('nenkin')
@ApiBearerAuth()
export class NenkinController {
  constructor(
    private readonly service: NenkinService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('/paper-templates')
  @UseGuards(TokenGuard)
  @ApiOperation({ description: 'Danh sách giấy tờ của từng lần thủ tục' })
  async paperTemplates() {
    return {
      [NenkinServiceType.FIRST]:
        NENKIN_PAPER_TEMPLATES[NenkinServiceType.FIRST],
      [NenkinServiceType.SECOND]:
        NENKIN_PAPER_TEMPLATES[NenkinServiceType.SECOND],
    };
  }

  @Get('/procedures')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_NENKIN_SERVICE)
  @ApiOperation({
    description: 'Hồ sơ Nenkin đã làm (lọc theo người lao động)',
  })
  async getMany(@Query() params: GetProceduresDto) {
    return this.service.getMany(params);
  }

  @Get('/procedures/:id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_NENKIN_SERVICE)
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post('/procedures')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.CREATE_NENKIN_SERVICE)
  @ApiOperation({
    description: 'Tạo / cập nhật hồ sơ Nenkin và sinh lại bộ giấy tờ',
  })
  async createOrUpdate(
    @Body() payload: CreateNenkinProcedureDto,
    @CurrentUser() user: UserIdentity,
  ) {
    return this.service.createOrUpdate(payload, user?.sub);
  }

  @Delete('/procedures/:id')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.DELETE_NENKIN_SERVICE)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteProcedure(id);
  }

  @Get('/procedures/:id/download')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_NENKIN_SERVICE)
  @ApiOperation({ description: 'Tải file PDF gộp cả bộ hồ sơ' })
  async downloadMerged(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const procedure = await this.service.getOne(id);
    const fullPath = this.uploadService.resolvePublicUrl(
      procedure.mergedFileUrl,
    );
    if (!fullPath) {
      throw new CBadRequestException(ErrorCode.NENKIN_TEMPLATE_NOT_CONFIGURED);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nenkin-${procedure.serviceType}-${procedure.workerId}.pdf"`,
    );
    this.uploadService.createReadStream(fullPath).pipe(res);
  }

  @Get('/documents/:id/download')
  @UseGuards(TokenGuard, RolesGuard)
  @CUseRoles(RolePers.GET_NENKIN_SERVICE)
  @ApiOperation({ description: 'Tải file PDF của một giấy tờ' })
  async download(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const document = await this.service.getDocument(id);
    const fullPath = this.uploadService.resolvePublicUrl(document.fileUrl);
    if (!fullPath) {
      throw new CBadRequestException(ErrorCode.NENKIN_DOCUMENT_NOT_FOUND);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.code}.pdf"`,
    );
    this.uploadService.createReadStream(fullPath).pipe(res);
  }
}
