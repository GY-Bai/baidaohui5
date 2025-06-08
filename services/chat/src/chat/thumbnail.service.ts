import { Injectable } from '@nestjs/common';

@Injectable()
export class ThumbnailService {
  private readonly R2_ENDPOINT = process.env.R2_ENDPOINT || '';
  private readonly R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '';
  private readonly R2_SECRET_KEY = process.env.R2_SECRET_KEY || '';
  private readonly R2_BUCKET = process.env.R2_BUCKET || 'baidaohui-chat';

  // 生成图片缩略图
  async generateThumbnail(
    imageBuffer: Buffer, 
    maxWidth = 256, 
    maxHeight = 256
  ): Promise<{ buffer: Buffer; width: number; height: number }> {
    try {
      // 这里应该使用sharp或其他图片处理库
      // 暂时返回原图作为缩略图
      return {
        buffer: imageBuffer,
        width: maxWidth,
        height: maxHeight,
      };
    } catch (error) {
      console.error('生成缩略图失败:', error);
      throw new Error('生成缩略图失败');
    }
  }

  // 上传文件到R2
  async uploadToR2(
    buffer: Buffer, 
    fileName: string, 
    contentType: string
  ): Promise<string> {
    try {
      // 这里应该使用AWS SDK或其他R2客户端
      // 暂时返回模拟的URL
      const fileUrl = `https://${this.R2_BUCKET}.r2.dev/chat/${fileName}`;
      
      console.log(`模拟上传文件到R2: ${fileUrl}`);
      
      return fileUrl;
    } catch (error) {
      console.error('上传到R2失败:', error);
      throw new Error('上传文件失败');
    }
  }

  // 处理图片消息
  async processImageMessage(
    imageBuffer: Buffer, 
    originalFileName: string
  ): Promise<{
    imageUrl: string;
    thumbnailUrl: string;
    width: number;
    height: number;
  }> {
    try {
      // 生成唯一文件名
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const fileExtension = originalFileName.split('.').pop() || 'jpg';
      
      const imageFileName = `image_${timestamp}_${randomId}.${fileExtension}`;
      const thumbnailFileName = `thumb_${timestamp}_${randomId}.${fileExtension}`;

      // 上传原图
      const imageUrl = await this.uploadToR2(
        imageBuffer, 
        imageFileName, 
        `image/${fileExtension}`
      );

      // 生成并上传缩略图
      const thumbnail = await this.generateThumbnail(imageBuffer);
      const thumbnailUrl = await this.uploadToR2(
        thumbnail.buffer, 
        thumbnailFileName, 
        `image/${fileExtension}`
      );

      return {
        imageUrl,
        thumbnailUrl,
        width: thumbnail.width,
        height: thumbnail.height,
      };
    } catch (error) {
      console.error('处理图片消息失败:', error);
      throw new Error('处理图片失败');
    }
  }

  // 处理文件消息
  async processFileMessage(
    fileBuffer: Buffer, 
    originalFileName: string,
    contentType: string
  ): Promise<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
  }> {
    try {
      // 生成唯一文件名
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const fileExtension = originalFileName.split('.').pop() || 'bin';
      
      const fileName = `file_${timestamp}_${randomId}.${fileExtension}`;

      // 上传文件
      const fileUrl = await this.uploadToR2(fileBuffer, fileName, contentType);

      return {
        fileUrl,
        fileName: originalFileName,
        fileSize: fileBuffer.length,
      };
    } catch (error) {
      console.error('处理文件消息失败:', error);
      throw new Error('处理文件失败');
    }
  }

  // 验证文件类型和大小
  validateFile(
    buffer: Buffer, 
    fileName: string, 
    maxSize = 10 * 1024 * 1024 // 10MB
  ): { isValid: boolean; error?: string } {
    // 检查文件大小
    if (buffer.length > maxSize) {
      return { 
        isValid: false, 
        error: `文件大小不能超过 ${Math.round(maxSize / 1024 / 1024)}MB` 
      };
    }

    // 检查文件扩展名
    const allowedExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', // 图片
      'pdf', 'doc', 'docx', 'txt', 'rtf', // 文档
      'mp3', 'wav', 'ogg', // 音频
      'mp4', 'webm', 'mov', // 视频
    ];

    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      return { 
        isValid: false, 
        error: '不支持的文件类型' 
      };
    }

    return { isValid: true };
  }

  // 检测文件是否为图片
  isImageFile(fileName: string): boolean {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    return fileExtension ? imageExtensions.includes(fileExtension) : false;
  }

  // 获取文件MIME类型
  getContentType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'mp4': 'video/mp4',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }
} 