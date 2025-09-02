import { Exclude } from 'class-transformer';
import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { Avatar } from './avatar.entity';

@Entity()
export class User {
  @PrimaryColumn()
  login: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  password: string;

  @Column()
  age: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string;

  @OneToMany(() => Avatar, (avatar) => avatar.user, { cascade: true })
  avatars: Avatar[];
}
