const timeStartRegex = /([^\d\w:]|^)/;
const timeEndRegex = /([^\d\w:]|$)/;

const timeRegex = /(\d{1,2}):(\d{2})(:(\d{2}))?/;

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

  moveToMatch(originalRegex) {
    const regex = new RegExp(originalRegex.source, "gi");
    regex.lastIndex = this.position;

    const match = regex.exec(this.input);
    if (match) {
      this.position = match.index;
    } else {
      throw new ParseError;
    }
  }

  parseRegex(originalRegex) {
    const regex = new RegExp(originalRegex.source, "yi");
    regex.lastIndex = this.position;
    const match = regex.exec(this.input);
    if (match) {
      this.position = regex.lastIndex;
    } else {
      throw new ParseError;
    }
    return match;
  }

  parseRegexWithSegment(regex) {
    return this.segmentFor(() => this.parseRegex(regex));
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

  parseWhitespace() {
    const regex = /\s+/;
    this.parseRegex(regex);
  }

  parseTimezone() {
    const regex = /\b(Z|UTC)\b/;
    this.parseRegex(regex);
    return "UTC";
  }

  parseTime() {
    const timeMatch = this.parseRegex(timeRegex);

    return {
      hour: parseInt(timeMatch[1]),
      minute: parseInt(timeMatch[2]),
      second: timeMatch[4] ? parseInt(timeMatch[4]) : 0
    }
  }

  parseYearLastDate() {
    const startRegex = /[^\d\w-/]|^/;
    const endRegex = /[^\d\w-/]|$/;
    const dateRegex = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;

    const dateMatch = this.parseRegex(dateRegex);
    console.log(dateMatch);

    let day, month;
    if (this.dateOrder === "us") {
      month = parseInt(dateMatch[1]);
      day = parseInt(dateMatch[2]);
    } else {
      day = parseInt(dateMatch[1]);
      month = parseInt(dateMatch[2]);
    }

    let year = dateMatch[3];
    if (year.length == 2) {
      year = parseInt(year);
      const currentYear = moment(this.relativeTo).year;
      const currentCentury = currentYear - (currentYear % 100);
      const previousCentury = currentCentury - 100;
      const nextCentury = currentCentury + 100;

      const options = [
        previousCentury + year,
        currentCentury + year,
        nextCentury + year
      ];

      year = options.map(x => [Math.abs(x - currentYear), x]).sort()[0][1];
    } else if (year.length == 4) {
      year = parseInt(year);
    } else {
      throw new ParseError;
    }

    return {
      
    }
  }

  parseTimeWithOptionalZone() {
    const time = this.parseTime();
    this.option(() => this.parseWhitespace());
    const zone = this.option(() => this.parseTimezone());
    return { time, zone };
  }

  parseTomorrow() {
    const regex = /\btomorrow\b/;

    this.moveToMatch(regex);

    const [segment, match] = this.parseRegexWithSegment(regex);

    return new Interval(
      moment(this.relativeTo).add(1, "day").startOf("day"),
      moment(this.relativeTo).add(2, "day").startOf("day"),
      segment
    );
  }

  parseYesterday() {
    const regex = /\byesterday\b/;

    this.moveToMatch(regex);

    const [segment, match] = this.parseRegexWithSegment(regex);

    return new Interval(
      moment(this.relativeTo).subtract(1, "day").startOf("day"),
      moment(this.relativeTo).startOf("day"),
      segment
    );
  }

  timeMatcher() {
    this.moveToMatch(timeRegex);
    return this.segmentFor(() => this.parseTimeWithOptionalZone());
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
