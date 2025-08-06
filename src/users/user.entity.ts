import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryColumn()
  login: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  age: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string;
}
