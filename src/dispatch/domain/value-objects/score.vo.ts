export class Score {
  readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static of(value: number): Score {
    if (isNaN(value)) {
      throw new Error(`Score: value must be a number, got NaN`);
    }
    if (value < 0 || value > 1) {
      throw new Error(`Score: value must be in [0, 1], got ${value}`);
    }
    return new Score(value);
  }

  /**
   * Returns the score multiplied by the given weight.
   * Used to compute weighted contribution to a composite score.
   */
  weighted(weight: number): number {
    return this.value * weight;
  }
}
