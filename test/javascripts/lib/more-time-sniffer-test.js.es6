import { InputSegment, Interval, Event, TimeSniffer } from "./time-sniffer";

const sandbox = sinon.createSandbox();

QUnit.module("lib:more-time-sniffer", {
  beforeEach() {
    const now = moment.utc("2020-02-20 13:00:00");
    sandbox.useFakeTimers(now.valueOf());

    this.context = {
      debugging: false,
      relativeTo: now.toISOString()
    };
  },

  afterEach() {
    sandbox.restore();
  }
});

QUnit.assert.sniffsCorrectly = function(input, expectations) {
  const { debugging } = this.test.testEnvironment;
  const { relativeTo } = this.test.testEnvironment.context;

  if (debugging) {
    console.log({
      input,
      expectations,
      context: this.test.testEnvironment.context
    });
  }

  const timeSniffer = new TimeSniffer(input, { relativeTo });
  const expectedIterationsCount = expectations.length;
  let iterationIndex = 0;

  this.test.assert.equal(
    timeSniffer.position,
    0,
    "TimeSniffer should start at position 0"
  );

  let match;
  while ((match = timeSniffer.next())) {
    if (debugging) {
      console.log({
        iterationIndex,
        expectedIterationsCount,
        match
      });
    }

    if (iterationIndex === expectedIterationsCount) {
      this.test.assert.ok(
        match.done,
        "TimeSniffer should be done on last iteration."
      );
      break;
    }

    if (iterationIndex > expectedIterationsCount) {
      throw "TimeSniffer had more iterations than expected";
    }

    const expectation = expectations[iterationIndex];
    this.test.assert.notOk(
      match.done,
      "TimeSniffer should not be done while iterating."
    );

    this.test.assert.deepEqual(
      match.value,
      new Interval(
        expectation.fromDate,
        expectation.toDate,
        new InputSegment(expectation.startIndex, expectation.endIndex)
      )
    );

    iterationIndex += 1;
  }
};

QUnit.test("should match tomorrow", assert => {
  assert.sniffsCorrectly("tomorrow", [
    {
      fromDate: "2020-02-21T00:00:00.000Z",
      toDate: "2020-02-22T00:00:00.000Z",
      startIndex: 0,
      endIndex: 8
    }
  ]);
});

QUnit.test("should match yesterday", assert => {
  assert.sniffsCorrectly("yesterday", [
    {
      fromDate: "2020-02-19T00:00:00.000Z",
      toDate: "2020-02-20T00:00:00.000Z",
      startIndex: 0,
      endIndex: 9
    }
  ]);
});

QUnit.test("should match a date", assert => {
  // assert.test.testEnvironment.debugging = true;

  assert.sniffsCorrectly("Let's meet up on 25/4/20", [
    {
      fromDate: "2020-04-25T00:00:00.000Z",
      toDate: "2020-04-26T00:00:00.000Z",
      startIndex: 17,
      endIndex: 24
    }
  ]);

  assert.sniffsCorrectly("Let's meet up on 25/04/20", [
    {
      fromDate: "2020-04-25T00:00:00.000Z",
      toDate: "2020-04-26T00:00:00.000Z",
      startIndex: 17,
      endIndex: 25
    }
  ]);

  assert.sniffsCorrectly("Let's meet up on 25/4/20 if you want", [
    {
      fromDate: "2020-04-25T00:00:00.000Z",
      toDate: "2020-04-26T00:00:00.000Z",
      startIndex: 17,
      endIndex: 24
    }
  ]);
});
