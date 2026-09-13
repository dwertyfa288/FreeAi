export interface ReasoningStreamPart {
  type: "text" | "thinking";
  delta: string;
}

interface ReasoningMarker {
  opening: string;
  closing: string;
}

const reasoningMarkers: ReasoningMarker[] = [
  { opening: "<think>", closing: "</think>" },
  { opening: "(Thought:", closing: ")" },
];

function partialMarkerLength(value: string, markers: string[]): number {
  const maximumLength = Math.min(value.length, Math.max(...markers.map((marker) => marker.length)) - 1);
  for (let length = maximumLength; length > 0; length -= 1) {
    const suffix = value.slice(-length);
    if (markers.some((marker) => marker.startsWith(suffix))) return length;
  }
  return 0;
}

function nextMarker(value: string): { index: number; marker: ReasoningMarker } | null {
  let match: { index: number; marker: ReasoningMarker } | null = null;
  for (const marker of reasoningMarkers) {
    const index = value.indexOf(marker.opening);
    if (index >= 0 && (match === null || index < match.index)) match = { index, marker };
  }
  return match;
}

export class ReasoningStreamParser {
  private buffer = "";
  private outputType: ReasoningStreamPart["type"] = "text";
  private closingMarker = "";

  push(delta: string): ReasoningStreamPart[] {
    this.buffer += delta;
    const parts: ReasoningStreamPart[] = [];

    while (this.buffer.length > 0) {
      if (this.outputType === "text") {
        const match = nextMarker(this.buffer);
        if (match) {
          if (match.index > 0) parts.push({ type: "text", delta: this.buffer.slice(0, match.index) });
          this.buffer = this.buffer.slice(match.index + match.marker.opening.length);
          this.outputType = "thinking";
          this.closingMarker = match.marker.closing;
          continue;
        }

        const retainedLength = partialMarkerLength(this.buffer, reasoningMarkers.map((marker) => marker.opening));
        const safeLength = this.buffer.length - retainedLength;
        if (safeLength > 0) parts.push({ type: "text", delta: this.buffer.slice(0, safeLength) });
        this.buffer = this.buffer.slice(safeLength);
        break;
      }

      const closingIndex = this.buffer.indexOf(this.closingMarker);
      if (closingIndex >= 0) {
        if (closingIndex > 0) parts.push({ type: "thinking", delta: this.buffer.slice(0, closingIndex) });
        this.buffer = this.buffer.slice(closingIndex + this.closingMarker.length);
        this.outputType = "text";
        this.closingMarker = "";
        continue;
      }

      const retainedLength = partialMarkerLength(this.buffer, [this.closingMarker]);
      const safeLength = this.buffer.length - retainedLength;
      if (safeLength > 0) parts.push({ type: "thinking", delta: this.buffer.slice(0, safeLength) });
      this.buffer = this.buffer.slice(safeLength);
      break;
    }

    return parts;
  }

  finish(): ReasoningStreamPart[] {
    if (this.buffer.length === 0) return [];
    const part = { type: this.outputType, delta: this.buffer };
    this.buffer = "";
    return [part];
  }
}
