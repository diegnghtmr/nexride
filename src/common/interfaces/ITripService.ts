import type { EntityManager } from 'typeorm';
import { CreateTripInput, Trip } from './shared-types';

export interface ITripService {
  /**
   * @param manager Optional TypeORM EntityManager. When called from inside a
   * transaction that already holds locks on related rows, callers MUST pass the
   * transaction's manager to avoid FK-validation deadlocks.
   */
  createMinimum(input: CreateTripInput, manager?: EntityManager): Promise<Trip>;
}

export const TRIP_SERVICE = Symbol('ITripService');
