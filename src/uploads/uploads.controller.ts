import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TokenGuard } from 'src/common/decorator/auth.decorator';
import { UploadService } from './uploads.service';

@ApiTags('Uploads')
@Controller('uploads')
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly service: UploadService) {}

  @Post('/image')
  @UseGuards(TokenGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    description: 'Tải ảnh giấy tờ, trả về { url } để gán vào hồ sơ',
  })
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.service.saveImage(file);
  }
}
