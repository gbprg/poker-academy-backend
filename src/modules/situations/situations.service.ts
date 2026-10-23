import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const STREETS = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'] as const;

@Injectable()
export class SituationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const spots = await this.prisma.spotDefinition.findMany({
      where: {
        versions: {
          some: {
            status: 'PUBLISHED',
          },
        },
      },
      select: {
        street: true,
      },
    });

    const countsByStreet = {
      preflop: 0,
      flop: 0,
      turn: 0,
      river: 0,
    };

    for (const spot of spots) {
      if (spot.street === 'PREFLOP') countsByStreet.preflop += 1;
      if (spot.street === 'FLOP') countsByStreet.flop += 1;
      if (spot.street === 'TURN') countsByStreet.turn += 1;
      if (spot.street === 'RIVER') countsByStreet.river += 1;
    }

    const universe = countsByStreet.preflop + countsByStreet.flop + countsByStreet.turn + countsByStreet.river;

    return {
      streets: STREETS.map((street) => {
        const key = street.toLowerCase() as keyof typeof countsByStreet;
        return {
          street,
          count: countsByStreet[key],
        };
      }),
      aleatorio: {
        count: universe,
      },
      total: universe,
    };
  }
}
