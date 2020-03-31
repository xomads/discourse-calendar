import { InputSegment, Interval, Event, TimeSniffer } from "./time-sniffer";

QUnit.module("lib:time-sniffer");

QUnit.test("should match tomorrow", assert => {
  const timeSniffer = new TimeSniffer(
    "Let's play a game tomorrow. Lorum ipsum",
    {
      relativeTo: "2020-02-03 08:31:00",
    }
  );
  let firstMatch = timeSniffer.next();
  let nextMatch = timeSniffer.next();

  assert.ok(!firstMatch.done);
  assert.ok(
    firstMatch.value.isSame(
      new Interval(
        "2020-02-04 00:00:00",
        "2020-02-05 00:00:00",
        new InputSegment(18, 26)
      )
    )
  );
  assert.ok(nextMatch.done);
});

QUnit.test("should match yesterday", assert => {
  const timeSniffer = new TimeSniffer(
    "Great game yesterday. Lorum ipsum",
    {
      relativeTo: "2020-02-04 08:31:00",
    }
  );
  let firstMatch = timeSniffer.next();
  let nextMatch = timeSniffer.next();

  assert.ok(!firstMatch.done);
  assert.ok(
    firstMatch.value.isSame(
      new Interval(
        "2020-02-03 00:00:00",
        "2020-02-04 00:00:00",
        new InputSegment(11, 20)
      )
    )
  );
  assert.ok(nextMatch.done);
});

QUnit.test("should match tomorrow and yesterday", assert => {
  const timeSniffer = new TimeSniffer(
    "Great game yesterday, let's play again tomorrow. Lorum ipsum",
    {
      relativeTo: "2020-02-04 08:31:00",
    }
  );
  let firstMatch = timeSniffer.next();
  let secondMatch = timeSniffer.next();
  let nextMatch = timeSniffer.next();

  assert.ok(!firstMatch.done, "firstMatch done");
  assert.ok(
    firstMatch.value.isSame(
      new Interval(
        "2020-02-03 00:00:00",
        "2020-02-04 00:00:00",
        new InputSegment(11, 20)
      )
    )
  );

  assert.ok(!secondMatch.done, "secondMatch done");

  console.trace('secondMatch', secondMatch);
  assert.ok(
    secondMatch.value.isSame(
      new Interval(
        "2020-02-05 00:00:00",
        "2020-02-06 00:00:00",
        new InputSegment(39, 47)
      )
    )
  );

  assert.ok(nextMatch.done);
});
