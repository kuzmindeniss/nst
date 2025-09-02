import * as AWS from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';

import { S3Lib } from './constants/do-spaces-service-lib.constant';
import { S3Service } from './s3.service';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [
    S3Service,
    {
      provide: S3Lib,
      useFactory: async (configService: ConfigService) => {
        return new AWS.S3({
          endpoint: configService.get('MINIO_ENDPOINT'),
          region: 'ru-central1',
          credentials: {
            accessKeyId: configService.get('MINIO_ROOT_USER') ?? '',
            secretAccessKey: configService.get('MINIO_ROOT_PASSWORD') ?? '',
          },
        });
      },
    },
  ],
  exports: [S3Service, S3Lib],
})
export class S3Module {}
