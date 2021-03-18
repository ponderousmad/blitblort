var TEST = (function () {
    "use strict";

    var TEST = {},
        testsPassed = 0,
        testsFailed = 0,
        testWarnings = 0;

    TEST.resetCounts = function () {
        testsPassed = 0;
        testsFailed = 0;
        testWarnings = 0;
    };

    TEST.passCount = function () {
        return testsPassed;
    };

    TEST.failCount = function () {
        return testsFailed;
    };

    TEST.warningCount = function () {
        return testWarnings;
    };

    TEST.contains = function (list, item) {
        for (var i = 0; i < list.length; ++i) {
            if (list[i] == item) {
                return true;
            }
        }
        return false;
    };

    TEST.WARNING = "Warning";
    TEST.ASSERT = "Assert";
    TEST.DISABLE = "Disable";

    function AssertException(message) {
        this.message = message;
    }

    AssertException.prototype.toString = function() {
        return this.message;
    };

    function fail(message, flag, comment) {
        if (flag === TEST.DISABLE)
        {
            return;
        }

        if (!message) {
            message = "Assertion Failed!";
        }
        if (comment) {
            message += " [" + comment + "]";
        }

        if (flag === TEST.WARNING) {
            console.log(message);
            ++testWarnings;
            return;
        }
        throw new AssertException(message);
    }

    TEST.fail = fail;
    TEST.isTrue = function (value, flag, comment) {
        if (!value) {
            fail("Expected truth, got " + String(value) + "!", flag, comment);
        }
    };
    TEST.isFalse = function (value, flag, comment) {
        if (value) {
            fail("Expected falsehood, got " + String(value) + "!", flag, comment);
        }
    };
    TEST.isNull = function (value, flag, comment) {
        if (value !== null) {
            fail("Expected null, got " + String(value) + "!", flag, comment);
        }
    };
    TEST.notNull = function (value, flag, comment) {
        if (value === null) {
            fail("Expected something, got " + String(value) + "!", flag, comment);
        }
    };
    TEST.isDefined = function (value, flag, comment) {
        if (typeof(value) === "undefined") {
            fail("Expected meaning, got " + String(value) + "!", flag, comment);
        }
    };
    TEST.notDefined = function (value, flag, comment) {
        if (typeof(value) !== "undefined") {
            fail("Expected undefined, got " + String(value) + "!", flag, comment);
        }
    };
    TEST.equals = function (a, b, flag, comment) {
        if (Array.isArray(a) && Array.isArray(b) && a.length == b.length) {
            if (a.every((element, index)=> element === b[index]))
            {
                return;
            }
        }
        if (a !== b) {
            fail("Expected " + String(a) + " === " + String(b) + ", but they differ!", flag, comment);
        }
    };
    TEST.notEquals = function (a, b, flag, comment) {
        if (Array.isArray(a) && Array.isArray(b) && a.length == b.length) {
            if (a.every((element, index)=> element === b[index]))
            {
                fail("Expected " + String(a) + " !== " + String(b) + ", but they match!", flag, comment);
                return;
            }
        }
        if (a === b) {
            fail("Expected " + String(a) + " !== " + String(b) + ", but they match!", flag, comment);
        }
    };
    TEST.same = function (a, b, flag, comment) {
        if (a != b) {
            fail("Expected " + String(a) + " == " + String(b) + ", but they are diferent objects!", flag, comment);
        }
    };
    TEST.notSame = function (a, b, flag, comment) {
        if (a == b) {
            fail("Expected " + String(a) + " != " + String(b) + ", but they are the same thing!", flag, comment);
        }
    };
    TEST.isEmpty = function (container, flag, comment) {
        if (Array.isArray(container)) {
            if (container.length > 0) {
                fail("Expected empty array, got " + String(container) + "!", flag, comment);
            }
        } else if (container) {
            if (Object.keys(container).length || container.constructor !== Object) {
                fail("Expected empty object, got " + String(container) + "!", flag, comment);
            }
        }
    };
    TEST.notEmpty = function (container, flag, comment) {
        if (Array.isArray(container)) {
            if (container.length === 0) {
                fail("Expected something in array, got " + String(container) + "!", flag, comment);
            }
        } else if (container) {
            if (Object.keys(container).length === 0 && container.constructor === Object) {
                fail("Expected something in object, got " + String(container) + "!", flag, comment);
            }
        } else {
            fail("Expected container with something, got " + String(container) + "!", flag, comment);
        }
    };
    TEST.inList = function (list, item, flag, comment) {
        if (Array.isArray(list)) {
            if (TEST.contains(list, item)) {
                return;
            }
        }
        fail("Expected array with " + String(item) + ", got " + String(list) + "!", flag, comment);
    };
    TEST.notInList = function (list, item, flag, comment) {
        if (Array.isArray(list)) {
            if (!TEST.contains(list, item)) {
                return;
            }
        }
        fail("Expected array with " + String(item) + ", got " + String(list) + "!", flag, comment);
    };
    TEST.tolEquals = function (a, b, tolerance, flag, comment) {
        tolerance = typeof(tolerance) === "undefined" ? 1e-6 : tolerance;
        const difference = a - b;
        if (Math.abs(difference) > tolerance)
        {
            fail("Expected " + String(a) + " and " + String(b) + " to be within " + tolerance + ", but they differ by " + difference + "!", flag, comment);
        }
    };

    TEST.run = function (name, tests, catchExceptions) {
        if (!Array.isArray(tests)) {
            tests = [tests];
        }
        if (tests.length === 0) {
            return;
        }
        console.log("Running " + name + " Tests");
        var passed = 0;
        const priorWarnings = testWarnings;
        for (var t = 0; t < tests.length; ++t) {
            var test = tests[t];
            if (catchExceptions) {
                try {
                    test();
                    ++passed;
                    ++testsPassed;
                } catch(e) {
                    testsFailed += 1;
                    console.log("Failed " + test.name + ":");
                    console.log(e);
                }
            } else {
                test();
                ++passed;
                ++testsPassed;
            }
        }
        const warnings = testWarnings - priorWarnings;
        console.log(passed + " tests passed." + (warnings ? " (with " + warnings + " warnings!)" : ""));
        return(passed == tests.length);
    };

    TEST.selfTestSuite = function (flag) {
        const passTests = [
            function testValidity() {
                TEST.isTrue(true);
                TEST.isTrue(1);
                TEST.isTrue("true");
                TEST.isTrue({});
                TEST.isTrue([]);
                TEST.isFalse(false);
                TEST.isFalse(null);
                TEST.isFalse(undefined);
                TEST.isFalse(0);
                TEST.isNull(null);
                TEST.notNull("hello");
                TEST.isDefined([]);
                TEST.notDefined(undefined);
            },
            function testEquality() {
                TEST.equals('a', 'a');
                TEST.equals(1, 1);
                TEST.equals(['a'], ['a']);

                TEST.notEquals('a', 'b');
                TEST.notEquals(1, 1.1);
                TEST.notEquals({}, []);

                const thing = {test:"hello"};
                const alias = thing;
                TEST.equals(thing, thing);
                TEST.equals(thing, alias);
            },
            function testSame() {
                const thing = {test:"hello"};
                TEST.same(thing, thing);
                const alias = thing;
                TEST.same(thing, alias);
                TEST.same(thing.test, thing.test);
                TEST.same(alias.test, thing.test, TEST.WARNING, "a rose by another name");
                const list = [1, 2, 3];
                TEST.same(list, list);
                const listAlias = list;
                TEST.same(list, listAlias);

                const other = {test:"hel" + "lo"};
                TEST.same(thing.test, other.test);

                TEST.notSame(thing, other);
                TEST.notSame(thing, thing.test);
                TEST.notSame(list, [1, 2, 3]);
            },
            function testContainers() {
                TEST.isEmpty([]);
                TEST.isEmpty({});
                TEST.notEmpty([1]);
                TEST.notEmpty({test:"hello"});
                TEST.inList([1, "two", 3], "two");
                TEST.notInList([1, "two", 3], 2);
            },
            function testTolerance() {
                TEST.tolEquals(0, 0);
                TEST.tolEquals(-1, -1);
                TEST.tolEquals(1e5, 1e5);

                TEST.tolEquals(0, 0.0000006);
                TEST.tolEquals(-1, -1.00005, TEST.ASSERT, "negative one tol equals");
                TEST.tolEquals(10001, 10001.0000009);

                TEST.tolEquals(0, 0.5, 1);
                TEST.tolEquals(-1, -1.00005, 0.0001);
                TEST.tolEquals(10001, 10002, 3);

                TEST.tolEquals(0, 0, 0, TEST.WARNING, "Impossible standards");
            }
        ];

        const warnTests = [
            function testValidity() {
                TEST.isTrue(false, TEST.WARNING, "Lies");
                TEST.isFalse(true, TEST.WARNING, "Damn lies");
                TEST.isNull("statistics", TEST.WARNING);
                TEST.notNull(null, TEST.WARNING);
                TEST.isDefined(undefined, TEST.WARNING);
                TEST.notDefined(a=>a, TEST.WARNING, "Identity crisis!");
            },
            function testEquality() {
                TEST.notEquals('a', 'a', TEST.WARNING);
                TEST.notEquals(1, 1, TEST.WARNING);
                TEST.notEquals(['a'], ['a'], TEST.WARNING);

                TEST.equals('a', 'b', TEST.WARNING, "One of these things is not like the other");
                TEST.equals(1, 1.1, TEST.WARNING, "One of these things just doesn't belong");
                TEST.equals({}, [], TEST.WARNING);

                const thing = {test:"hello"};
                const alias = thing;
                TEST.notEquals(thing, thing, TEST.WARNING);
                TEST.notEquals(thing, alias, TEST.WARNING);
            },
            function testSame() {
                const thing = {test:"hello"};
                TEST.notSame(thing, thing, TEST.WARNING, "identiy");
                const alias = thing;
                TEST.notSame(thing, alias, TEST.WARNING, "object alias");
                TEST.notSame(thing.test, thing.test, TEST.WARNING, "property");
                TEST.notSame(alias.test, thing.test, TEST.WARNING, "aliased property");
                const list = [1, 2, 3];
                TEST.notSame(list, list, TEST.WARNING, "list");
                const listAlias = list;
                TEST.notSame(list, listAlias, TEST.WARNING, "list alias");

                const other = {test:"hel" + "lo"};
                TEST.notSame(thing.test, other.test, TEST.WARNING, "reconstructed property");

                TEST.same(thing, other, TEST.WARNING, "object reconstruction");
                TEST.same(thing, thing.test, TEST.WARNING, "object vs member");
                TEST.same(list, [1, 2, 3], TEST.WARNING, "reconstructed list");
            },
            function testContainers() {
                TEST.notEmpty([], TEST.WARNING, "empty array");
                TEST.notEmpty({}, TEST.WARNING, "empty list");
                TEST.isEmpty([1], TEST.WARNING, "non empty array");
                TEST.isEmpty({test:"hello"}, TEST.WARNING, "non empty object");
                TEST.inList([1, "two", 3], "three", TEST.WARNING, "Four?");
                TEST.notInList([1, "two", 4], "4", TEST.WARNING, "Four!");
            },
            function testTolerance() {
                TEST.tolEquals(0, "1", undefined, TEST.WARNING, "tolerance for nonsense");
                TEST.tolEquals(1, -1, undefined, TEST.WARNING, "on the flip side...");
                TEST.tolEquals(1e5, 1e-5, undefined, TEST.WARNING, "problems of this magnitude");

                TEST.tolEquals(-1, -1.00005, 0.00000001, TEST.WARNING, "Not close enough");
                TEST.tolEquals(10002.0001, 10002.0002, 0.00005, TEST.WARNING, "Far away");
            }
        ];

        // List of lists, because must do each fail test separately
        const failTests = [
            [ function testIsTrue() { TEST.isTrue(false); }],
            [ function testIsFalse() { TEST.isFalse(1, TEST.ASSERT); }],
            [ function testIsNull() { TEST.isNull({}, TEST.ASSERT, "Objectively not null"); }],
            [ function testNotNull() { TEST.notNull(null); }],
            [ function testIsDefined() { TEST.isDefined(undefined); }],
            [ function testNotDefined() { TEST.notDefined(null, TEST.ASSERT, "Black, black emptiness"); }],
            [ function testEquals() { TEST.equals(undefined, null, TEST.ASSERT, "WOT?"); }],
            [ function testNotEquals() { TEST.notEquals(1, 1, TEST.ASSERT); }],
            [ function testSame() { TEST.same([], {}, TEST.ASSERT, "WOT?"); }],
            [ function testNotSame() { TEST.notSame(1, "1", TEST.ASSERT); }],
            [ function testIsEmpty() { TEST.isEmpty([1]); }],
            [ function testNotEmpty() { TEST.notEmpty({}, TEST.ASSERT); }],
            [ function testInList() { TEST.inList([], 1, TEST.ASSERT); }],
            [ function testNotInList() { TEST.notInList({}, 1); }],
            [ function testTolEquals() { TEST.tolEquals(Math.PI, 355/113, 1e-10, TEST.ASSERT, "Mmmmm, pie!"); }]
        ];

        TEST.run("Self Test - Pass", passTests);
        if (flag === TEST.WARNING || flag === TEST.ASSERT) {
            TEST.run("Self Test - Warn", warnTests);
        }
        if (flag === TEST.ASSERT) {
            for (var f = 0; f < failTests.length; ++f) {
                var passed = TEST.run("Self Test - Fail " + (f + 1), failTests[f], true);
                if (passed)
                {
                    console.log("Expected failure for test " + failTests[f] + ", but it passed!");
                }
            }
        }
    };

    return TEST;
}());
