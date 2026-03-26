import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { Rating } from "src/rating/entities/rating.entity";
import { OneToMany } from "typeorm";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    name: string;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column({ default: false })
    isAdmin: boolean;

    @OneToMany(() => Rating, (rating) => rating.user)
    ratings: Rating[];
}
