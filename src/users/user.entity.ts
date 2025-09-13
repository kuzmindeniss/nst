import { Exclude, Expose } from 'class-transformer';
import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { Avatar } from './avatar.entity';

@Entity('user')
export class User {
  @Expose()
  @PrimaryColumn()
  login: string;

  @Expose()
  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  password: string;

  @Expose()
  @Column()
  age: number;

  @Expose()
  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string;

  @Expose()
  @OneToMany(() => Avatar, (avatar) => avatar.user, { cascade: true })
  avatars: Avatar[];

  @Expose()
  @Column({ type: 'decimal', scale: 2, default: 0 })
  balance: number;
}
