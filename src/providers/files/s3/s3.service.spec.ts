import { Test, TestingModule } from '@nestjs/testing';

import { S3Service } from './s3.service';
import { ConfigService } from '@nestjs/config';
import { S3Lib } from './constants/do-spaces-service-lib.constant';

describe('S3Service', () => {
  let service: S3Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: S3Lib,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                MINIO_ENDPOINT: 'http://localhost:9000',
                MINIO_ROOT_USER: 'test-user',
                MINIO_ROOT_PASSWORD: 'test-password',
              };
              return config[key as keyof typeof config];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
