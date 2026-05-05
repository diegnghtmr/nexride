import { CreateTripInput, Trip } from './shared-types';

export interface ITripService {
  createMinimum(input: CreateTripInput): Promise<Trip>;
}

export const TRIP_SERVICE = Symbol('ITripService');
