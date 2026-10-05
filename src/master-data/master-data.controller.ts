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
import {
  NTA_TAX_OFFICE_SEARCH_URL,
  TaxOfficeService,
} from './tax-office.service';

@ApiTags('MasterData')
@Controller('master-data')
@ApiBearerAuth()
export class MasterDataController {
  constructor(
    private readonly postalCodeService: PostalCodeService,
    private readonly taxOfficeService: TaxOfficeService,
  ) {}

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

  @Get('/jp-postal-code')
  @UseGuards(TokenGuard)
  @ApiQuery({ name: 'prefectureCode', example: '37' })
  @ApiQuery({ name: 'address', example: '東かがわ市引田3475番地1地先' })
  @ApiOperation({
    description:
      'Tra mã bưu điện Nhật Bản theo địa chỉ (dữ liệu 日本郵便 đóng gói sẵn)',
  })
  async lookupPostalCode(
    @Query('prefectureCode') prefectureCode: string,
    @Query('address') address: string,
  ) {
    return this.postalCodeService.reverseLookup(prefectureCode, address);
  }

  @Get('/tax-offices')
  @UseGuards(TokenGuard)
  @ApiOperation({
    description:
      'Danh sách 税務署 của 国税庁, kèm khu vực quản lý và địa chỉ gửi hồ sơ',
  })
  async taxOffices() {
    return {
      data: this.taxOfficeService.list(),
      searchUrl: NTA_TAX_OFFICE_SEARCH_URL,
    };
  }

  @Get('/tax-offices/suggest')
  @UseGuards(TokenGuard)
  @ApiQuery({ name: 'prefectureCode', example: '37' })
  @ApiQuery({ name: 'address', example: '東かがわ市引田3475番地1地先' })
  @ApiOperation({
    description:
      'Gợi ý 税務署 phụ trách địa chỉ cuối cùng ở Nhật. Quận chia cho nhiều sở thì nhờ AI chọn theo danh sách 町名.',
  })
  async suggestTaxOffice(
    @Query('prefectureCode') prefectureCode: string,
    @Query('address') address: string,
  ) {
    return this.taxOfficeService.suggest(prefectureCode, address);
  }
}
