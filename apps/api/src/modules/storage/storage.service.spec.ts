import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CLOUDINARY_URL') {
                return 'cloudinary://969793829971679:qmMrlycp8M67qamcoWblk5qYVqg@oiy6ygxr';
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should respond to ping health check', async () => {
    const isUp = await service.ping();
    expect(typeof isUp).toBe('boolean');
    expect(isUp).toBe(true);
  });
});
