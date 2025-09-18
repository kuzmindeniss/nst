import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
import { Avatar } from '../avatar.entity';

@Injectable()
export class AvatarRepository {
  constructor(
    @InjectRepository(Avatar)
    private readonly repository: Repository<Avatar>,
  ) {}

  async findById({
    id,
    relations,
  }: {
    id: string;
    relations?: FindOptionsRelations<Avatar>;
  }): Promise<Avatar | null> {
    return this.repository.findOne({
      where: { id },
      relations,
    });
  }

  async create(avatarData: Partial<Avatar>): Promise<Avatar> {
    const avatar = this.repository.create(avatarData);
    return this.repository.save(avatar);
  }

  async save(avatar: Avatar): Promise<Avatar> {
    return this.repository.save(avatar);
  }

  async remove(avatar: Avatar): Promise<Avatar> {
    return this.repository.remove(avatar);
  }
}
