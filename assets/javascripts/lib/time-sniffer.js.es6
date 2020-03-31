class ParseError {}

class SniffedTime {
  constructor(opts = {}) {
    if (!(this.year = opts.year)) { throw "expected year"; }
    if (!(this.month = opts.month)) { throw "expected month"; }
    if (!(this.day = opts.day)) { throw "expected day"; }
    this.hour = opts.hour || 0;
    this.minute = opts.minute || 0;
    this.second = opts.second || 0;
    this.timezone = opts.timezone || "UTC";
  }

  isSame(other) {
    return (other instanceof SniffedTime) &&
      other.year === this.year &&
      other.month === this.month &&
      other.day === this.day &&
      other.hour === this.hour &&
      other.minute === this.minute &&
      other.second === this.second &&
      other.timezone === this.timezone;
  }
}

export class InputSegment {
  constructor(from, to) {
    if ((this.from = from) === undefined) { throw "expected from in InputSegment"; }
    if (!(this.to = to)) { throw "expected to"; }
  }

  isSame(other) {
    return other instanceof InputSegment &&
      this.from === other.from &&
      this.to === other.to;
  }
}

export class Interval {
  constructor(from, to, segment) {
    if (!(this.from = from)) { throw "expected from in Interval"; }
    if (!(this.to = to)) { throw "expected to"; }
    if (!(this.segment = segment)) { throw "expected segment"; }
  }

  isSame(other) {
    return other instanceof Interval &&
      moment(this.from).isSame(other.from) &&
      moment(this.to).isSame(other.to) &&
      this.segment.isSame(other.segment);
  }
}

export class Event {
  constructor(at, segment) {
    if (!(this.at = at)) { throw "expected at"; }
    if (!(this.segment = segment)) { throw "expected segment"; }
  }

  isSame(other) {
    return other instanceof Interval &&
      moment(this.at).isSame(other.at) &&
      this.segment.isSame(other.segment);
  }
}

export class TimeSniffer {
  constructor(input, opts) {
    this.input = input;
    this.position = 0;
    if (!(this.relativeTo = opts.relativeTo)) { throw "expected relativeTo"; }
  }

  segmentFor(fn) {

    const firstPosition = this.position;
    const result = fn();
    const lastPosition = this.position;


    return [
      new InputSegment(
        firstPosition,
        lastPosition
      ),
      result
    ];
  }

  option(fn) {
    let oldPosition = this.position;
    try {
      return fn();
    } catch (e) {
      if (e instanceof ParseError) {
        this.position = oldPosition;
        return null;
      } else {
        throw e;
      }
    }
  }

  peek(fn) {
    let oldPosition = this.position;
    try {
      const result = fn();
      return [this.position, result];
    } finally {
      this.position = oldPosition;
    }
  }

  moveToMatch(regexString) {
    const regex = new RegExp(regexString, "gi");
    regex.lastIndex = this.position;

    const match = regex.exec(this.input);
    if (match) {
      this.position = match.index;
    } else {
      throw new ParseError;
    }
  }

  parseRegex(regexString) {
    const regex = new RegExp(regexString, "yi");
    regex.lastIndex = this.position;
    const match = regex.exec(this.input);
    if (match) {
      this.position = regex.lastIndex;
    } else {
      throw new ParseError;
    }
    return match;
  }

  firstOf(parsers) {
    let lowestStart = Infinity;
    let lowestValue = undefined;
    let lowestRecoverTo = undefined;

    for (let parser of parsers) {
      this.option(() => {
        const [recoverTo, [segment, value]] = this.peek(parser);

        if (lowestStart > segment.from) {
          lowestStart = segment.from;
          lowestValue = value;
          lowestRecoverTo = recoverTo;
        }
      });
    }

    if (lowestStart < Infinity) {
      this.position = lowestRecoverTo;
      return lowestValue;
    } else {
      throw new ParseError;
    }
  }

  parseTomorrow() {
    this.moveToMatch("tomorrow");

    let [segment, match] = this.segmentFor(() => {
      return this.parseRegex("tomorrow");
    });

    console.log('yesterday match', segment);

    return new Interval(
      moment(this.relativeTo).add(1, "day").startOf("day"),
      moment(this.relativeTo).add(2, "day").startOf("day"),
      segment
    );
  }

  parseYesterday() {
    this.moveToMatch("yesterday");

    let [segment, match] = this.segmentFor(() => {
      return this.parseRegex("yesterday");
    });

    console.log('yesterday match', segment);

    return new Interval(
      moment(this.relativeTo).subtract(1, "day").startOf("day"),
      moment(this.relativeTo).startOf("day"),
      segment
    );
  }

  [Symbol.iterator]() {
    return this;
  }

  next() {
    let parsed = this.option(() => {
      return this.firstOf([
        () => {
          const match = this.parseTomorrow();
          return [match.segment, match];
        },
        () => {
          const match = this.parseYesterday();
          return [match.segment, match];
        }
      ]);
    });

    if (parsed) {
      return {
        value: parsed,
        done: false
      };
    } else {
      return { done: true };
    }
  }
}
