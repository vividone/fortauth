import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { FortApiKey } from '../entities/fort-api-key.entity';
import { FortUser } from '../entities/fort-user.entity';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';

const KEY_PREFIX = 'fort_';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(FortApiKey)
    private readonly apiKeyRepo: Repository<FortApiKey>,
    @InjectRepository(FortUser)
    private readonly userRepo: Repository<FortUser>,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  async create(
    userId: string,
    name: string,
    scopes?: string[],
    expiresAt?: Date,
  ): Promise<{ key: string; id: string; keyPrefix: string }> {
    const rawKey = KEY_PREFIX + randomBytes(32).toString('hex');
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = this.apiKeyRepo.create({
      userId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      expiresAt,
    });
    await this.apiKeyRepo.save(apiKey);

    return { key: rawKey, id: apiKey.id, keyPrefix };
  }

  async validate(apiKey: string): Promise<FortUser | null> {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.slice(0, 12);

    const entity = await this.apiKeyRepo.findOne({
      where: { keyPrefix, keyHash, revokedAt: IsNull() },
      relations: ['user'],
    });

    if (!entity) return null;

    // Check expiry
    if (entity.expiresAt && entity.expiresAt < new Date()) return null;

    // Check user is active
    if (!entity.user.isActive) return null;

    // Update last used
    entity.lastUsedAt = new Date();
    await this.apiKeyRepo.save(entity);

    return entity.user;
  }

  async list(userId: string): Promise<Omit<FortApiKey, 'keyHash'>[]> {
    const keys = await this.apiKeyRepo.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return keys.map(({ keyHash, ...rest }) => rest);
  }

  async revoke(userId: string, keyId: string): Promise<void> {
    const key = await this.apiKeyRepo.findOne({
      where: { id: keyId, userId },
    });
    if (!key) throw new NotFoundException('API key not found');

    key.revokedAt = new Date();
    await this.apiKeyRepo.save(key);
  }
}
