import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';

@Injectable()
export class ThumbnailService {
  async generateThumbnail(buffer: Buffer, maxSize: number = 256): Promise<Buffer> {
    return sharp(buffer)
      .resize(maxSize, maxSize, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
} 