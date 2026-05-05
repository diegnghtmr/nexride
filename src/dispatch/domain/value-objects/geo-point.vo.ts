export class GeoPoint {
  readonly lat: number;
  readonly lng: number;

  private constructor(lat: number, lng: number) {
    this.lat = lat;
    this.lng = lng;
  }

  static of(lat: number, lng: number): GeoPoint {
    if (lat < -90 || lat > 90) {
      throw new Error(`GeoPoint: lat must be in [-90, 90], got ${lat}`);
    }
    if (lng < -180 || lng > 180) {
      throw new Error(`GeoPoint: lng must be in [-180, 180], got ${lng}`);
    }
    return new GeoPoint(lat, lng);
  }

  /**
   * Returns the great-circle distance in km between this point and another,
   * using the Haversine formula.
   */
  distanceKmHaversine(other: GeoPoint): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(other.lat - this.lat);
    const dLng = this.toRad(other.lng - this.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(this.lat)) * Math.cos(this.toRad(other.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
