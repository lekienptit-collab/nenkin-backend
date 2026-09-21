import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AGENT_RELATIONS,
  BANK_ACCOUNT_TYPES,
  BANKS,
  JP_PREFECTURES,
  VN_PROVINCES,
} from 'src/common/constatns/master-data';
import { TokenGuard } from 'src/common/decorator/auth.decorator';
import { PostalCodeService } from './postal-code.service';

@ApiTags('MasterData')
@Controller('master-data')
@ApiBearerAuth()
export class MasterDataController {
  constructor(private readonly postalCodeService: PostalCodeService) {}

  @Get()
  @UseGuards(TokenGuard)
  @ApiOperation({ description: 'Dữ liệu tham chiếu cho các ô chọn trên form' })
  async getAll() {
    return {
      jpPrefectures: JP_PREFECTURES,
      vnProvinces: VN_PROVINCES,
      banks: BANKS,
      bankAccountTypes: BANK_ACCOUNT_TYPES,
      agentRelations: AGENT_RELATIONS,
    };
  }

  @Get('/jp-address')
  @UseGuards(TokenGuard)
  @ApiQuery({ name: 'postalCode', example: '321-4522' })
  @ApiOperation({ description: 'Tra địa chỉ Nhật Bản theo mã bưu điện' })
  async lookupAddress(@Query('postalCode') postalCode: string) {
    return this.postalCodeService.lookup(postalCode);
  }
}
