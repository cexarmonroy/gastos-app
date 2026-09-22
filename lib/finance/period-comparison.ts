export type ComparisonDirection = "up" | "down" | "flat" | "new" | "none";

export interface ComparisonMetric {
  current: number;
  previous: number;
  deltaPercent: number | null;
  direction: ComparisonDirection;
  hasPreviousData: boolean;
}

export function computeMetric(
  current: number,
  previous: number,
  previousHasRecords: boolean
): ComparisonMetric {
  if (!previousHasRecords) {
    return {
      current,
      previous: 0,
      deltaPercent: null,
      direction: "none",
      hasPreviousData: false,
    };
  }

  if (previous === 0 && current === 0) {
    return {
      current,
      previous,
      deltaPercent: 0,
      direction: "flat",
      hasPreviousData: true,
    };
  }

  if (previous === 0) {
    return {
      current,
      previous,
      deltaPercent: null,
      direction: "new",
      hasPreviousData: true,
    };
  }

  const deltaPercent = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const direction: ComparisonDirection =
    deltaPercent > 0 ? "up" : deltaPercent < 0 ? "down" : "flat";

  return {
    current,
    previous,
    deltaPercent,
    direction,
    hasPreviousData: true,
  };
}
